// scripts/registrar-resultado-redes.mjs
//
// Registra en 21_PUBLICACIONES_REDES el resultado que Make deja en
// RESULTADO_PUBLICACION__<publicacion_id>.json, reconcilia pendientes, gestiona
// reintentos por red (max 3), maneja EN_PROCESO sin RESULTADO y pendiente_seguro,
// archiva los paquetes a 06/07/08 y limpia 05_LISTOS_PUBLICAR.
//
// Nunca publica en redes ni llama a Make. Solo lee JSON de OneDrive y escribe la
// hoja 21. La verificacion real en la plataforma la hace Make (a peticion del
// marcador con verificar_antes_de_publicar); aqui solo se interpreta su reporte.
//
// Modos:
//   node scripts/registrar-resultado-redes.mjs --reconciliar
//       -> recorre 05_LISTOS_PUBLICAR y resuelve todo lo pendiente (idempotente).
//   node scripts/registrar-resultado-redes.mjs --registrar --publicacion-id=<id>
//       -> procesa una sola publicacion.
//
// Idempotente: consumir un RESULTADO lo elimina; los paquetes terminales salen de
// 05; re-ejecutar no duplica registros, intentos ni archivos. Usa un lock.

import ExcelJS from "exceljs";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const RUMBO_ROOT =
  process.env.RUMBO_ONEDRIVE_ROOT ||
  "C:\\RUMBO"; // <ruta_operativa_RUMBO> — definir con la variable de entorno RUMBO_ONEDRIVE_ROOT
const LISTOS_DIR = path.join(RUMBO_ROOT, "05_LISTOS_PUBLICAR");
const DIR_PUBLICADOS = path.join(RUMBO_ROOT, "06_PUBLICADOS");
const DIR_PARCIAL = path.join(RUMBO_ROOT, "07_PUBLICADOS_PARCIAL");
const DIR_ERRORES = path.join(RUMBO_ROOT, "08_ERRORES");
const LOG_DIR = path.join(RUMBO_ROOT, "00_HERRAMIENTAS", "LOGS");
const LOCK_FILE = path.join(LISTOS_DIR, ".registrando.lock");
const MARKER_PREFIX = "LISTO_PARA_PUBLICAR";
const ENPROCESO_PREFIX = "EN_PROCESO";
const RESULTADO_PREFIX = "RESULTADO_PUBLICACION";
const MAX_INTENTOS = 3;
const REDES = ["facebook", "instagram"];
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 min: un lock mas viejo se considera huerfano

// ---------- utilidades ----------
function ahoraISO() {
  return new Date().toISOString();
}
function sufijoId(id) {
  return String(id || "").replace(/^pub-/, "");
}
function esSi(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "sí" || s === "si" || s === "true" || s === "1";
}
async function ensureDir(d) {
  await fsp.mkdir(d, { recursive: true });
}
function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

let LOG_BUFFER = [];
function log(msg) {
  const line = `[${ahoraISO()}] ${msg}`;
  LOG_BUFFER.push(line);
  console.log(line);
}
async function flushLog() {
  try {
    await ensureDir(LOG_DIR);
    const f = path.join(LOG_DIR, "redes-cierre.log");
    await fsp.appendFile(f, LOG_BUFFER.join("\n") + "\n", "utf-8");
  } catch (e) {
    console.error("No se pudo escribir el log:", e.message);
  }
}

// ---------- lock ----------
async function adquirirLock() {
  await ensureDir(LISTOS_DIR);
  if (fs.existsSync(LOCK_FILE)) {
    const st = fs.statSync(LOCK_FILE);
    if (Date.now() - st.mtimeMs < LOCK_TTL_MS) return false; // lock vigente
    log("Lock huerfano detectado; se reemplaza.");
  }
  await fsp.writeFile(LOCK_FILE, `${process.pid} ${ahoraISO()}\n`, "utf-8");
  return true;
}
async function liberarLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) await fsp.rm(LOCK_FILE);
  } catch {}
}

// ---------- Excel (hoja 21) ----------
function abrirWorkbook() {
  const xlsx = fs
    .readdirSync(RUMBO_ROOT)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (xlsx.length !== 1)
    throw new Error(`Se esperaba 1 .xlsx en ${RUMBO_ROOT}, hay ${xlsx.length}`);
  return path.join(RUMBO_ROOT, xlsx[0]);
}
function mapaColumnas(ws) {
  const m = {};
  ws.getRow(4).eachCell({ includeEmpty: false }, (c, n) => {
    const name = String(c.value ?? "").trim();
    if (name) m[name] = n;
  });
  return m;
}
function leerFilas(ws, col) {
  const filas = [];
  for (let r = 5; r <= ws.rowCount; r++) {
    const first = ws.getRow(r).getCell(col.publicacion_id).value;
    if (first === null || first === undefined || String(first).trim() === "")
      continue;
    const obj = { __row: r };
    for (const [name, n] of Object.entries(col)) {
      let v = ws.getRow(r).getCell(n).value;
      if (v && typeof v === "object" && "text" in v) v = v.text;
      obj[name] = v === undefined ? null : v;
    }
    filas.push(obj);
  }
  return filas;
}

// ---------- resultado / marcador ----------
function normalizarResultado(res) {
  // Devuelve mapa red -> {estado, post_id, url, fecha, error}
  const out = {};
  const arr = (res && res.resultados) || [];
  for (const e of arr) {
    const red = String(e.red || "").toLowerCase();
    if (!REDES.includes(red)) continue;
    let estado = e.estado;
    if (!estado) estado = e.exito === true ? "publicada" : e.exito === false ? "error" : "indeterminado";
    out[red] = {
      estado,
      post_id: e.post_id || null,
      url: e.url || e.url_final || null,
      fecha: e.fecha_hora || e.fecha || null,
      error: e.mensaje_error || e.error || null,
    };
  }
  return out;
}
function archivosDe(id, dir) {
  const suf = sufijoId(id);
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.includes(String(id)) ||
        f.includes(`pub-${suf}`) ||
        f === `${MARKER_PREFIX}__${id}.json` ||
        f === `${ENPROCESO_PREFIX}__${id}.json` ||
        f === `${RESULTADO_PREFIX}__${id}.json`
    );
}
async function moverPaquete(id, destinoBase) {
  const destino = path.join(destinoBase, String(id));
  await ensureDir(destino);
  let movidos = 0;
  for (const f of archivosDe(id, LISTOS_DIR)) {
    await fsp.rename(path.join(LISTOS_DIR, f), path.join(destino, f)).catch(async () => {
      // rename entre dispositivos: copiar+borrar
      await fsp.copyFile(path.join(LISTOS_DIR, f), path.join(destino, f));
      await fsp.rm(path.join(LISTOS_DIR, f));
    });
    movidos++;
  }
  return { destino, movidos };
}

// ---------- reintento ----------
async function generarMarcadorReintento(id, fila, redesPendientes, redesCompletadas, verificar) {
  // Reusar el marcador vigente (medios/textos) si existe.
  const posibles = [
    path.join(LISTOS_DIR, `${ENPROCESO_PREFIX}__${id}.json`),
    path.join(LISTOS_DIR, `${MARKER_PREFIX}__${id}.json`),
  ];
  let base = null;
  for (const p of posibles) if (fs.existsSync(p)) { base = readJsonSafe(p); break; }
  if (!base) {
    log(`No hay marcador base para reintentar ${id}; se deja pendiente_seguro.`);
    return false;
  }
  const nuevo = {
    ...base,
    estado: "lista_para_publicar",
    permitir_publicacion: true,
    es_reintento: true,
    verificar_antes_de_publicar: !!verificar,
    redes_completadas: redesCompletadas,
    omitir_redes: redesCompletadas.map((r) => r.red),
    redes_a_publicar: redesPendientes,
    reintento_generado_en: ahoraISO(),
  };
  // Escritura atomica: temporal sin el prefijo, luego rename.
  const tmp = path.join(LISTOS_DIR, `.reintento__${id}.json`);
  const fin = path.join(LISTOS_DIR, `${MARKER_PREFIX}__${id}.json`);
  await fsp.writeFile(tmp, JSON.stringify(nuevo, null, 2), "utf-8");
  // limpiar EN_PROCESO previo para que no quede colgado
  const enproc = path.join(LISTOS_DIR, `${ENPROCESO_PREFIX}__${id}.json`);
  if (fs.existsSync(enproc)) await fsp.rm(enproc);
  await fsp.rename(tmp, fin);
  return true;
}

// ---------- nucleo: procesar una publicacion ----------
async function procesarPublicacion(fila, ws, col, wb, excelPath) {
  const id = String(fila.publicacion_id);
  const setC = (name, val) => {
    if (col[name]) ws.getRow(fila.__row).getCell(col[name]).value = val;
  };
  const resPath = path.join(LISTOS_DIR, `${RESULTADO_PREFIX}__${id}.json`);
  const resultado = normalizarResultado(readJsonSafe(resPath));
  const autorizadas = REDES.filter((r) => esSi(fila[`publicar_${r}`]));
  if (autorizadas.length === 0) {
    log(`${id}: sin redes autorizadas; se ignora.`);
    return { id, estadoGlobal: "sin_redes" };
  }

  const redEstado = {}; // red -> estado final tras este procesamiento
  const completadas = [];
  const pendientesRecuperables = [];
  const intentosPorRed = {};
  let algunIndeterminado = false;

  for (const red of autorizadas) {
    const postPrevio = fila[`${red}_post_id`];
    const r = resultado[red];
    if (postPrevio) {
      // ya publicada en un intento anterior: no se toca
      redEstado[red] = "publicada";
      completadas.push({ red, post_id: postPrevio, url: fila[`${red}_url`] || null, fecha: fila[`${red}_fecha_publicacion`] || null });
      continue;
    }
    if (r && r.estado === "publicada" && r.post_id) {
      redEstado[red] = "publicada";
      setC(`${red}_estado`, "publicada");
      setC(`${red}_post_id`, r.post_id);
      setC(`${red}_url`, r.url || "");
      setC(`${red}_fecha_publicacion`, r.fecha || ahoraISO());
      setC(`${red}_error`, "");
      completadas.push({ red, post_id: r.post_id, url: r.url || null, fecha: r.fecha || null });
    } else if (r && r.estado === "error") {
      const intentos = Number(fila[`${red}_intentos`] || 0) + 1;
      intentosPorRed[red] = intentos;
      setC(`${red}_intentos`, intentos);
      setC(`${red}_fecha_intento`, ahoraISO());
      setC(`${red}_error`, r.error || "error");
      if (intentos >= MAX_INTENTOS) {
        redEstado[red] = "error"; // definitivo
        setC(`${red}_estado`, "error");
      } else {
        redEstado[red] = "recuperable";
        setC(`${red}_estado`, "error");
        pendientesRecuperables.push(red);
      }
    } else if (r && r.estado === "indeterminado") {
      redEstado[red] = "indeterminado";
      setC(`${red}_estado`, "indeterminado");
      algunIndeterminado = true;
    } else {
      // No hay resultado para esta red: EN_PROCESO sin RESULTADO -> verificar
      redEstado[red] = "indeterminado";
      setC(`${red}_estado`, "indeterminado");
      algunIndeterminado = true;
    }
  }

  const hayPublicada = autorizadas.some((r) => redEstado[r] === "publicada");
  const hayRecuperable = pendientesRecuperables.length > 0;
  const todasPublicadas = autorizadas.every((r) => redEstado[r] === "publicada");
  const todasError = autorizadas.every((r) => redEstado[r] === "error");

  let estadoGlobal;
  let accion;
  if (algunIndeterminado) {
    estadoGlobal = "pendiente_seguro";
    accion = "verificar"; // no republicar; re-emitir marcador de verificacion
  } else if (hayRecuperable) {
    estadoGlobal = "en_proceso";
    accion = "reintentar";
  } else if (todasPublicadas) {
    estadoGlobal = "publicada";
    accion = "archivar:06";
  } else if (hayPublicada && todasErrorEntreNoPublicadas(autorizadas, redEstado)) {
    estadoGlobal = "publicada_parcial";
    accion = "archivar:07";
  } else if (todasError) {
    estadoGlobal = "error";
    accion = "archivar:08";
  } else {
    estadoGlobal = "error";
    accion = "archivar:08";
  }

  setC("estado", estadoGlobal);
  setC("resultado", resumenResultado(estadoGlobal, redEstado));
  const fechas = REDES.map((r) => fila[`${r}_fecha_publicacion`]).filter(Boolean);
  if (completadas.length) setC("fecha_publicacion", completadas.map((c) => c.fecha).filter(Boolean).slice(-1)[0] || ahoraISO());
  const intentosGlobal = Math.max(0, ...REDES.map((r) => Number(intentosPorRed[r] || fila[`${r}_intentos`] || 0)));
  setC("intentos", intentosGlobal);

  // Persistir Excel antes de mover archivos (durabilidad).
  await wb.xlsx.writeFile(excelPath);

  // Consumir el RESULTADO ya registrado (idempotencia).
  if (fs.existsSync(resPath)) {
    // se moverá con el paquete si archivamos; si no, se elimina para no reprocesar
    if (accion.startsWith("archivar")) {
      /* se mueve con el paquete */
    } else {
      await fsp.rm(resPath);
    }
  }

  if (accion === "reintentar") {
    const ok = await generarMarcadorReintento(id, fila, pendientesRecuperables, completadas, false);
    log(`${id}: ${estadoGlobal}; reintento de [${pendientesRecuperables.join(",")}] ${ok ? "programado" : "no posible"}.`);
  } else if (accion === "verificar") {
    const ok = await generarMarcadorReintento(id, fila, autorizadas.filter((r) => redEstado[r] === "indeterminado"), completadas, true);
    log(`${id}: pendiente_seguro; verificacion ${ok ? "programada" : "no posible"} (no se republica).`);
  } else if (accion.startsWith("archivar")) {
    const destinoBase = accion.endsWith("06") ? DIR_PUBLICADOS : accion.endsWith("07") ? DIR_PARCIAL : DIR_ERRORES;
    const { destino, movidos } = await moverPaquete(id, destinoBase);
    log(`${id}: ${estadoGlobal}; ${movidos} archivo(s) archivados en ${path.basename(destinoBase)}/${id}; jornada lista para cierre.`);
    return { id, estadoGlobal, archivadoEn: destino };
  }
  return { id, estadoGlobal };
}

function todasErrorEntreNoPublicadas(autorizadas, redEstado) {
  return autorizadas.filter((r) => redEstado[r] !== "publicada").every((r) => redEstado[r] === "error");
}
function resumenResultado(estadoGlobal, redEstado) {
  const partes = Object.entries(redEstado).map(([r, e]) => `${r}:${e}`);
  return `${estadoGlobal} (${partes.join(", ")})`;
}

// ---------- reconciliar ----------
function idsPendientesEnListos() {
  if (!fs.existsSync(LISTOS_DIR)) return [];
  const ids = new Set();
  for (const f of fs.readdirSync(LISTOS_DIR)) {
    let m =
      f.match(new RegExp(`^${RESULTADO_PREFIX}__(.+)\\.json$`)) ||
      f.match(new RegExp(`^${ENPROCESO_PREFIX}__(.+)\\.json$`));
    if (m) ids.add(m[1]);
  }
  return [...ids];
}

async function ejecutar({ modo, publicacionId }) {
  const excelPath = abrirWorkbook();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.getWorksheet("21_PUBLICACIONES_REDES");
  const col = mapaColumnas(ws);
  const filas = leerFilas(ws, col);
  const porId = new Map(filas.map((f) => [String(f.publicacion_id), f]));

  let objetivo;
  if (modo === "registrar") {
    objetivo = publicacionId ? [publicacionId] : [];
  } else {
    objetivo = idsPendientesEnListos();
  }
  if (objetivo.length === 0) {
    log(modo === "registrar" ? "Nada que registrar." : "Reconciliacion: sin pendientes en 05_LISTOS_PUBLICAR.");
    return { procesadas: [] };
  }

  const procesadas = [];
  for (const id of objetivo) {
    const fila = porId.get(String(id));
    if (!fila) {
      log(`${id}: sin fila en 21_PUBLICACIONES_REDES; no se puede registrar (se conserva en 05, pendiente_seguro).`);
      procesadas.push({ id, estadoGlobal: "sin_fila" });
      continue;
    }
    try {
      const r = await procesarPublicacion(fila, ws, col, wb, excelPath);
      procesadas.push(r);
    } catch (e) {
      log(`${id}: ERROR al procesar: ${e.message}`);
      procesadas.push({ id, estadoGlobal: "error_proceso", detalle: e.message });
    }
  }
  return { procesadas };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const a = { modo: null, publicacionId: null };
  for (const x of argv) {
    if (x === "--reconciliar") a.modo = "reconciliar";
    else if (x === "--registrar") a.modo = "registrar";
    else if (x.startsWith("--publicacion-id=")) a.publicacionId = x.split("=")[1];
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.modo) {
    console.error("Uso: --reconciliar | --registrar --publicacion-id=<id>");
    process.exitCode = 1;
    return;
  }
  const lock = await adquirirLock();
  if (!lock) {
    log("Otra ejecucion tiene el lock; se omite esta corrida.");
    return;
  }
  try {
    const { procesadas } = await ejecutar(args);
    log(`Fin. Procesadas: ${procesadas.length} -> ${procesadas.map((p) => `${p.id}:${p.estadoGlobal}`).join("; ")}`);
  } finally {
    await liberarLock();
    await flushLog();
  }
}

main().catch(async (e) => {
  console.error("Fallo inesperado en registrar-resultado-redes:", e);
  await liberarLock();
  await flushLog();
  process.exitCode = 1;
});
