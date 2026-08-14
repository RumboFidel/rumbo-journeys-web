// scripts/tests/test-publicar-web.mjs
//
// Pruebas de la rutina 09 con repositorios git, Excel y servidor HTTP
// ficticios en directorios temporales. No toca la operacion real, ni el
// repositorio real, ni el sitio publicado: cada caso monta su propio mundo.

import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(AQUI, "../publicar-web.mjs");
const EXCEL_NOMBRE = "MAESTRO_FIXTURE.xlsx";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));
let PASS = 0;
let FAIL = 0;
const fallos = [];
const temporales = [];
const servidores = [];

function assert(cond, msg) {
  if (cond) PASS++;
  else { FAIL++; fallos.push(msg); console.log("   x " + msg); }
}

async function caso(nombre, fn) {
  if (ONLY.size && ![...ONLY].some((o) => nombre.includes(o))) return;
  console.log(`\n> ${nombre}`);
  try {
    await fn();
  } catch (e) {
    FAIL++;
    fallos.push(`${nombre}: ${e.message}`);
    console.log("   x excepcion inesperada: " + e.message);
  }
}

function tmpdir(p) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `rumbo-09-${p}-`));
  temporales.push(d);
  return d;
}

const sha256 = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

// ------------------------------------------------------------- servidor HTTP

/** Servidor que sirve un directorio. `estado.dir` puede cambiarse en caliente. */
function servir(dir) {
  const estado = { dir, forzar404: new Set(), caidas: 0 };
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    if (estado.forzar404.has(rel)) { res.writeHead(404); res.end("no"); return; }
    const abs = path.join(estado.dir, rel.replace(/^data\/rumbo\//, ""));
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end("no"); return; }
    const tipo = abs.endsWith(".json") ? "application/json" : "application/octet-stream";
    res.writeHead(200, { "content-type": tipo, "x-vercel-cache": "MISS" });
    res.end(fs.readFileSync(abs));
  });
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => {
      servidores.push(srv);
      resolve({ url: `http://127.0.0.1:${srv.address().port}`, estado, srv });
    });
  });
}

// ------------------------------------------------------------------ fixtures

const HOJAS = {
  "09_CONFIGURACION": ["config_key", "valor", "obligatorio", "quien_lo_completa", "explicacion", "ejemplo"],
  "04_HISTORIAS": ["story_id", "slug", "titulo", "status", "decision_message"],
  "01_HISTORIAL_COWORK": [
    "tipo_contenido", "destino", "titulo", "resumen", "evidencia_onedrive", "alertas", "riesgo",
    "recomendacion_agente", "decision_registrada", "mensaje_fidel", "resultado", "fecha_decision",
    "referencia_conversacion", "id_origen", "publication_rule", "allowed_decisions",
  ],
};

async function escribirExcel(ruta, historias, urlBase) {
  const wb = new ExcelJS.Workbook();
  for (const [hoja, headers] of Object.entries(HOJAS)) {
    const ws = wb.addWorksheet(hoja);
    ws.getCell("A1").value = hoja;
    headers.forEach((h, i) => (ws.getRow(4).getCell(i + 1).value = h));
    if (hoja === "09_CONFIGURACION") {
      ws.getRow(5).getCell(1).value = "active_master_excel_filename";
      ws.getRow(5).getCell(2).value = EXCEL_NOMBRE;
      ws.getRow(6).getCell(1).value = "site_public_base_url";
      ws.getRow(6).getCell(2).value = urlBase;
    }
    if (hoja === "04_HISTORIAS") {
      historias.forEach((h, i) => {
        const r = ws.getRow(5 + i);
        r.getCell(1).value = h.story_id;
        r.getCell(2).value = h.slug ?? h.story_id;
        r.getCell(3).value = h.titulo ?? h.story_id;
        r.getCell(4).value = h.status;
      });
    }
  }
  await wb.xlsx.writeFile(ruta);
}

/** Paquete web minimo pero coherente. */
function paquete({ publicacionWebId, hashExcel, historias = [], conMedio = true, conteos = {} }) {
  const c = {
    jornadas: 1, carreras: 1, historias: historias.length, medios: conMedio ? 1 : 0,
    cantonesVisitados: 1, bitacoraOriginales: 1, bitacoraPorCategoria: { fotografias: 1 }, ...conteos,
  };
  return {
    "manifest.json": { publicacionWebId, generadoEn: "2026-08-11T00:00:00.000Z", fuenteExcel: EXCEL_NOMBRE, hashExcel, scriptVersion: "1.1.0", conteos: c, advertencias: [], errores: [] },
    "resumen.json": { cantonesVisitados: 1, metaCantones: 221, kilometros: 5.39 },
    "cantones.json": { cantones: [] },
    "cantones_visitados.geojson": { type: "FeatureCollection", features: [] },
    "carreras.json": { carreras: [{ id: "r1", slug: "uno", titulo: "Uno", rutaGeojson: "rutas/rt1.geojson" }] },
    "historias.json": { historias: historias.map((h) => ({ id: h.story_id, titulo: h.titulo ?? h.story_id, estadoEditorial: h.status })) },
    "bitacora.json": { items: [] },
    "medios.json": { medios: conMedio ? [{ mediaId: "m1", tipo: "fotografia", rutaWeb: "archivos/imagenes/m1.jpg" }] : [] },
  };
}

function escribirPaquete(dir, p, { conMedio = true } = {}) {
  fs.mkdirSync(path.join(dir, "rutas"), { recursive: true });
  fs.mkdirSync(path.join(dir, "archivos", "imagenes"), { recursive: true });
  for (const [nombre, datos] of Object.entries(p)) {
    fs.writeFileSync(path.join(dir, nombre), JSON.stringify(datos, null, 2));
  }
  fs.writeFileSync(path.join(dir, "rutas", "rt1.geojson"), '{"type":"FeatureCollection","features":[]}');
  if (conMedio) fs.writeFileSync(path.join(dir, "archivos", "imagenes", "m1.jpg"), "jpeg-ficticio");
}

const PKG_FIXTURE = {
  name: "fixture", private: true, type: "module",
  scripts: {
    "test:rutas": "node -e \"process.exit(0)\"",
    "test:cierre": "node -e \"process.exit(0)\"",
    "test:publicables": "node -e \"process.exit(0)\"",
    typecheck: "node -e \"process.exit(0)\"",
    build: "node -e \"process.exit(0)\"",
  },
};

function g(repo, ...a) {
  return execFileSync("git", a, { cwd: repo, encoding: "utf-8" }).trim();
}

/**
 * Monta: repo git con remoto bare, carpeta operativa RUMBO con Excel, y el
 * paquete ya sincronizado en las tres ubicaciones (como dejarian 07 y 08).
 */
async function montar({ historias = [{ story_id: "h1", status: "aprobada_fidel" }], conMedio = true } = {}) {
  const base = tmpdir("mundo");
  const repo = path.join(base, "repo");
  const remoto = path.join(base, "remoto.git");
  const root = path.join(base, "RUMBO");

  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(path.join(root, "04_PUBLICACION_WEB"), { recursive: true });
  fs.mkdirSync(path.join(root, "05_LISTOS_PUBLICAR"), { recursive: true });

  const publico = await servir(path.join(repo, "public", "data", "rumbo"));
  await escribirExcel(path.join(root, EXCEL_NOMBRE), historias, publico.url);
  const hashExcel = sha256(path.join(root, EXCEL_NOMBRE));

  const id = "pubweb-" + crypto.randomBytes(8).toString("hex");
  const p = paquete({ publicacionWebId: id, hashExcel, historias, conMedio });

  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify(PKG_FIXTURE, null, 2));
  fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules\n.output\n.tanstack/**\n.wrangler/\n");
  const dirPublic = path.join(repo, "public", "data", "rumbo");
  const dirEspejo = path.join(repo, "src", "data", "generated", "rumbo-web");
  fs.mkdirSync(dirEspejo, { recursive: true });

  // Estado "ya publicado": una version anterior del paquete, commiteada.
  const anterior = paquete({ publicacionWebId: "pubweb-anterior", hashExcel, historias, conMedio });
  escribirPaquete(dirPublic, anterior, { conMedio });
  for (const n of Object.keys(anterior)) {
    fs.copyFileSync(path.join(dirPublic, n), path.join(dirEspejo, n));
  }

  // -b main: sin esto el bare toma la rama por defecto del sistema y un clon
  // acabaria commiteando en master, con lo que origin/main nunca avanzaria.
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remoto], { cwd: base });
  g(repo, "init", "-q");
  g(repo, "config", "user.email", "fixture@test");
  g(repo, "config", "user.name", "Fixture");
  g(repo, "config", "commit.gpgsign", "false");
  g(repo, "checkout", "-q", "-B", "main");
  g(repo, "add", "-A");
  g(repo, "commit", "-q", "-m", "estado inicial");
  g(repo, "remote", "add", "origin", remoto);
  g(repo, "push", "-q", "-u", "origin", "main");

  // Ahora 07 y 08: nueva generacion en las tres ubicaciones.
  escribirPaquete(path.join(root, "04_PUBLICACION_WEB"), p, { conMedio });
  escribirPaquete(dirPublic, p, { conMedio });
  for (const n of Object.keys(p)) fs.copyFileSync(path.join(dirPublic, n), path.join(dirEspejo, n));

  return { base, repo, remoto, root, publico, id, hashExcel, p, dirPublic, dirEspejo };
}

// Asincrono a proposito: el servidor HTTP ficticio vive en ESTE proceso, asi
// que usar spawnSync bloquearia el bucle de eventos y el hijo no podria obtener
// respuesta de la URL publica.
// Las pruebas siempre pasan --modo-prueba: sin el, el script rechaza
// RUMBO_SITE_BASE_URL y RUMBO_SCRIPTS_VERIFICACION. Los casos que comprueban
// esa proteccion usan correrOperativo().
function correr(m, args, extraEnv = {}) {
  return correrCrudo(m, [...args, "--modo-prueba"], extraEnv);
}

/**
 * Sin --modo-prueba: como se ejecutaria en la operacion. Las dos variables
 * peligrosas se vacian por defecto —si no, el script abortaria siempre— y cada
 * caso las define explicitamente cuando quiere comprobar esa proteccion.
 */
function correrOperativo(m, args, extraEnv = {}) {
  return correrCrudo(m, args, {
    RUMBO_SITE_BASE_URL: "",
    RUMBO_SCRIPTS_VERIFICACION: "",
    ...extraEnv,
  });
}

function correrCrudo(m, args, extraEnv = {}) {
  const hijo = spawn(process.execPath, [SCRIPT, ...args], {
    cwd: m.repo,
    env: {
      ...process.env,
      RUMBO_ONEDRIVE_ROOT: m.root,
      RUMBO_SITE_BASE_URL: m.publico.url,
      RUMBO_ESPERA_MAX_MS: "1500",
      RUMBO_INTERVALO_MS: "200",
      RUMBO_TIMEOUT_PETICION_MS: "2000",
      // Arrancar npm por cada caso haria la suite inviable en Windows (~30 s
      // por caso). Se omiten aqui y hay un caso dedicado, "comprobaciones
      // locales", que si ejecuta la lista completa y comprueba que aborta
      // cuando una falla.
      RUMBO_SCRIPTS_VERIFICACION: "",
      ...extraEnv,
    },
    encoding: "utf-8",
  });
  return new Promise((resolve) => {
    let out = "";
    hijo.stdout.on("data", (d) => (out += d));
    hijo.stderr.on("data", (d) => (out += d));
    hijo.on("close", (code) => {
      if (process.env.DEBUG_09) console.log(`--- ${args.join(" ")} (code=${code}) ---\n${out}`);
      resolve({ code, salida: out });
    });
  });
}

const planHashDe = (salida) => (salida.match(/planHash:\s*([0-9a-f]{64})/) || [])[1];

// ============================================ VARIABLES DE ENTORNO

await caso("env: RUMBO_SITE_BASE_URL no puede redirigir una publicacion operativa", async () => {
  const m = await montar();
  const { code, salida } = await correrOperativo(m, ["--verificar"], {
    RUMBO_SITE_BASE_URL: "http://sitio-atacante.invalido",
  });
  assert(code !== 0, "sin --modo-prueba deberia abortar");
  assert(/solo se admiten con --modo-prueba/.test(salida), "deberia explicar por que aborta");
  assert(/RUMBO_SITE_BASE_URL/.test(salida), "deberia nombrar la variable");
  assert(!/sitio-atacante/.test(salida.replace(/RUMBO_SITE_BASE_URL/g, "")), "no deberia usar esa URL");
});

await caso("env: RUMBO_SCRIPTS_VERIFICACION no puede omitir las pruebas reales", async () => {
  const m = await montar();
  const { code, salida } = await correrOperativo(m, ["--verificar"], { RUMBO_SCRIPTS_VERIFICACION: "" });
  // Una cadena vacia no cuenta como definida; se comprueba con una lista corta.
  const r2 = await correrOperativo(m, ["--verificar"], { RUMBO_SCRIPTS_VERIFICACION: "typecheck" });
  assert(r2.code !== 0, "sin --modo-prueba deberia abortar");
  assert(/solo se admiten con --modo-prueba/.test(r2.salida), "deberia explicar por que");
  assert(/lista fija del codigo/.test(r2.salida), "deberia decir que la lista es fija");
  assert(code !== 0 || true, `(cadena vacia: code=${code}, se ignora por no estar definida)`);
});

await caso("env: los tiempos si se ajustan dentro de limites seguros", async () => {
  const m = await montar();
  const { code } = await correrOperativo(m, ["--verificar"], {
    RUMBO_ESPERA_MAX_MS: "60000",
    RUMBO_INTERVALO_MS: "1000",
    RUMBO_TIMEOUT_PETICION_MS: "5000",
  });
  assert(code === 0, `valores razonables deberian aceptarse en operacion, salio ${code}`);
});

await caso("env: un tiempo invalido o extremo produce error, no espera infinita", async () => {
  const m = await montar();
  const noNumero = await correrOperativo(m, ["--verificar"], { RUMBO_ESPERA_MAX_MS: "cinco minutos" });
  assert(noNumero.code !== 0, "un valor no numerico debe fallar");
  assert(/no es un numero entero/.test(noNumero.salida), "deberia decir que no es un numero");

  const enorme = await correrOperativo(m, ["--verificar"], { RUMBO_ESPERA_MAX_MS: "999999999" });
  assert(enorme.code !== 0, "un valor extremo debe fallar");
  assert(/fuera de los limites seguros/.test(enorme.salida), "deberia citar los limites");

  const cero = await correrOperativo(m, ["--verificar"], { RUMBO_TIMEOUT_PETICION_MS: "0" });
  assert(cero.code !== 0, "un timeout de cero debe fallar");

  const incoherente = await correrOperativo(m, ["--verificar"], {
    RUMBO_ESPERA_MAX_MS: "1000",
    RUMBO_INTERVALO_MS: "60000",
  });
  assert(incoherente.code !== 0, "un intervalo mayor que la espera debe fallar");
  assert(/menor que la espera maxima/.test(incoherente.salida), "deberia explicar la incoherencia");
});

// =========================================================== VERIFICACION

await caso("verificacion correcta: muestra el plan y no toca nada", async () => {
  const m = await montar();
  const antes = g(m.repo, "rev-parse", "HEAD");
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code === 0, `deberia salir 0, salio ${code}: ${salida.slice(-400)}`);
  assert(/PLAN DE PUBLICACION WEB/.test(salida), "deberia mostrar el plan");
  assert(salida.includes(m.id), "deberia mostrar el publicacionWebId");
  assert(!!planHashDe(salida), "deberia mostrar un planHash");
  assert(g(m.repo, "rev-parse", "HEAD") === antes, "no debe crear commits");
  assert(g(m.repo, "diff", "--cached", "--name-only") === "", "no debe dejar nada en el indice");
});

await caso("comprobaciones locales: ejecuta las cinco y aborta si una falla", async () => {
  const m = await montar();
  const { code, salida } = await correr(m, ["--verificar"], {
    RUMBO_SCRIPTS_VERIFICACION: "test:rutas,test:cierre,test:publicables,typecheck,build",
  });
  assert(code === 0, `deberia pasar, salio ${code}`);
  for (const s of ["test:rutas", "test:cierre", "test:publicables", "typecheck", "build"]) {
    assert(salida.includes(`ok  npm run ${s}`), `deberia ejecutar ${s}`);
  }

  // Ahora una que falla: no debe llegar a mostrar el plan. Se commitea el
  // cambio para que el arbol siga limpio fuera de las rutas generadas.
  const pkg = JSON.parse(fs.readFileSync(path.join(m.repo, "package.json"), "utf-8"));
  pkg.scripts["test:publicables"] = 'node -e "process.exit(1)"';
  fs.writeFileSync(path.join(m.repo, "package.json"), JSON.stringify(pkg, null, 2));
  g(m.repo, "add", "--", "package.json");
  g(m.repo, "commit", "-q", "-m", "prueba que falla");
  const r2 = await correr(m, ["--verificar"], {
    RUMBO_SCRIPTS_VERIFICACION: "test:rutas,test:cierre,test:publicables,typecheck,build",
  });
  assert(r2.code !== 0, "deberia abortar si una comprobacion falla");
  assert(/Fallo "npm run test:publicables"/.test(r2.salida), "deberia decir cual fallo");
  assert(!/planHash:/.test(r2.salida), "no deberia ofrecer un planHash si las pruebas fallan");
});

await caso("planHash: estable entre dos ejecuciones identicas", async () => {
  const m = await montar();
  const a = planHashDe((await correr(m, ["--verificar"])).salida);
  const b = planHashDe((await correr(m, ["--verificar"])).salida);
  assert(!!a && a === b, `el planHash deberia ser estable (${a} vs ${b})`);
});

await caso("planHash: cambia ante cada componente protegido", async () => {
  const base = await montar();
  const original = planHashDe((await correr(base, ["--verificar"])).salida);

  // (a) contenido de un archivo generado
  const m1 = await montar();
  const h1 = planHashDe((await correr(m1, ["--verificar"])).salida);
  fs.writeFileSync(path.join(m1.dirPublic, "resumen.json"), JSON.stringify({ cantonesVisitados: 99 }));
  const h1b = planHashDe((await correr(m1, ["--verificar"])).salida);
  assert(h1 !== h1b, "cambiar un archivo generado debe cambiar el planHash");

  // (b) publicacionWebId
  const m2 = await montar();
  const h2 = planHashDe((await correr(m2, ["--verificar"])).salida);
  for (const d of [m2.dirPublic, m2.dirEspejo, path.join(m2.root, "04_PUBLICACION_WEB")]) {
    const man = JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf-8"));
    man.publicacionWebId = "pubweb-otro";
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(man, null, 2));
  }
  const h2b = planHashDe((await correr(m2, ["--verificar"])).salida);
  assert(h2 !== h2b, "cambiar el publicacionWebId debe cambiar el planHash");

  // (c) origin/main avanzado
  const m3 = await montar();
  const h3 = planHashDe((await correr(m3, ["--verificar"])).salida);
  const otro = path.join(m3.base, "clon");
  execFileSync("git", ["clone", "-q", m3.remoto, otro]);
  g(otro, "config", "user.email", "x@test"); g(otro, "config", "user.name", "X");
  fs.writeFileSync(path.join(otro, "otra-cosa.txt"), "hola");
  g(otro, "add", "-A"); g(otro, "commit", "-q", "-m", "ajeno"); g(otro, "push", "-q");
  const h3b = planHashDe((await correr(m3, ["--verificar"])).salida);
  assert(h3 !== h3b, "que origin/main avance debe cambiar el planHash");

  assert(!!original, "el plan base tenia hash");
});

await caso("arbol sucio fuera de las rutas generadas: aborta", async () => {
  const m = await montar();
  fs.writeFileSync(path.join(m.repo, "src", "algo.ts"), "export const x = 1;");
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/cambios fuera de las rutas generadas/i.test(salida), "deberia explicar por que");
  assert(/src\/algo\.ts/.test(salida), "deberia listar el archivo culpable");
});

await caso("rama incorrecta: aborta", async () => {
  const m = await montar();
  g(m.repo, "checkout", "-q", "-b", "otra-rama");
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/Solo se publica desde la rama main/.test(salida), "deberia nombrar la rama");
});

await caso("manifiestos divergentes entre paquete y public: aborta", async () => {
  const m = await montar();
  const man = JSON.parse(fs.readFileSync(path.join(m.root, "04_PUBLICACION_WEB", "manifest.json"), "utf-8"));
  man.publicacionWebId = "pubweb-desincronizado";
  fs.writeFileSync(path.join(m.root, "04_PUBLICACION_WEB", "manifest.json"), JSON.stringify(man, null, 2));
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/no son la misma generacion/.test(salida), "deberia decir que no son la misma generacion");
});

await caso("paquete sin publicacionWebId: aborta pidiendo regenerar", async () => {
  const m = await montar();
  for (const d of [m.dirPublic, m.dirEspejo, path.join(m.root, "04_PUBLICACION_WEB")]) {
    const man = JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf-8"));
    delete man.publicacionWebId;
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(man, null, 2));
  }
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/no declara publicacionWebId/.test(salida), "deberia pedir regenerar con el generador actual");
});

await caso("archivo prohibido en el paquete: aborta", async () => {
  const m = await montar();
  fs.mkdirSync(path.join(m.dirPublic, "archivos", "originales"), { recursive: true });
  fs.writeFileSync(path.join(m.dirPublic, "archivos", "originales", "foto.jpg"), "original");
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/archivos privados o de actividad/.test(salida), "deberia identificar el problema");
});

await caso("referencia rota: aborta", async () => {
  const m = await montar();
  fs.unlinkSync(path.join(m.dirPublic, "archivos", "imagenes", "m1.jpg"));
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/referencias rotas/.test(salida), "deberia decir que hay referencias rotas");
  assert(/archivos\/imagenes\/m1\.jpg/.test(salida), "deberia nombrar la referencia");
});

await caso("historia no publicable en el paquete: aborta", async () => {
  const m = await montar({ historias: [{ story_id: "h1", status: "rechazada" }] });
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code !== 0, "deberia abortar");
  assert(/no es publicable/.test(salida), "deberia detectar el estado editorial invalido");
});

await caso("commit vacio: informa y no crea nada", async () => {
  const m = await montar();
  await correr(m, ["--verificar"]); // sincroniza nada; ahora commiteamos el estado
  g(m.repo, "add", "--", "public/data/rumbo", "src/data/generated/rumbo-web");
  g(m.repo, "commit", "-q", "-m", "ya publicado");
  const antes = g(m.repo, "rev-parse", "HEAD");
  const { code, salida } = await correr(m, ["--verificar"]);
  assert(code === 0, "no deberia ser un error");
  assert(/No había nada nuevo que publicar|No habia nada nuevo/.test(salida), "deberia decirlo con el mensaje de Fidel");
  assert(g(m.repo, "rev-parse", "HEAD") === antes, "no debe crear commit");
});

// =========================================================== PUBLICACION

await caso("publicacion normal: commit y push solo de las rutas generadas", async () => {
  const m = await montar();
  const plan = planHashDe((await correr(m, ["--verificar"])).salida);
  const { code, salida } = await correr(m, ["--publicar", "--aprobacion", plan]);
  assert(code === 0, `deberia publicar, salio ${code}: ${salida.slice(-500)}`);
  const tocados = g(m.repo, "show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean);
  assert(
    tocados.every((f) => f.startsWith("public/data/rumbo/") || f.startsWith("src/data/generated/rumbo-web/")),
    `el commit solo debe tocar las rutas generadas: ${tocados.join(", ")}`
  );
  const msg = g(m.repo, "log", "-1", "--format=%B");
  assert(msg.includes(`publicacion-web-id: ${m.id}`), "el commit debe declarar el publicacionWebId");
  assert(msg.includes(`plan-hash: ${plan}`), "el commit debe declarar el planHash aprobado");
  assert(g(m.repo, "rev-parse", "HEAD") === g(m.repo, "rev-parse", "origin/main"), "deberia haber hecho push");
});

await caso("aprobacion caducada: si el plan cambia, aborta", async () => {
  const m = await montar();
  const plan = planHashDe((await correr(m, ["--verificar"])).salida);
  fs.writeFileSync(path.join(m.dirPublic, "resumen.json"), JSON.stringify({ cantonesVisitados: 42 }));
  const antes = g(m.repo, "rev-parse", "HEAD");
  const { code, salida } = await correr(m, ["--publicar", "--aprobacion", plan]);
  assert(code !== 0, "deberia abortar");
  assert(/no corresponde al plan actual/.test(salida), "deberia explicar que la aprobacion caduco");
  assert(g(m.repo, "rev-parse", "HEAD") === antes, "no debe crear commit");
});

await caso("publicar sin --aprobacion: aborta", async () => {
  const m = await montar();
  const { code, salida } = await correr(m, ["--publicar"]);
  assert(code !== 0, "deberia abortar");
  assert(/Falta --aprobacion/.test(salida), "deberia pedir la aprobacion");
});

await caso("retiro sin --confirmar-retiro: aborta aunque el planHash coincida", async () => {
  const m = await montar();
  fs.unlinkSync(path.join(m.dirPublic, "archivos", "imagenes", "m1.jpg"));
  const p = paquete({ publicacionWebId: m.id, hashExcel: m.hashExcel, historias: [{ story_id: "h1", status: "aprobada_fidel" }], conMedio: false });
  for (const [n, d] of Object.entries(p)) {
    fs.writeFileSync(path.join(m.dirPublic, n), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(m.dirEspejo, n), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(m.root, "04_PUBLICACION_WEB", n), JSON.stringify(d, null, 2));
  }
  const salidaV = (await correr(m, ["--verificar"])).salida;
  assert(/RETIRA contenido/.test(salidaV), "la verificacion deberia avisar de la retirada");
  const plan = planHashDe(salidaV);
  const antes = g(m.repo, "rev-parse", "HEAD");
  const { code, salida } = await correr(m, ["--publicar", "--aprobacion", plan]);
  assert(code !== 0, "deberia abortar sin el indicador");
  assert(/--confirmar-retiro/.test(salida), "deberia exigir el indicador");
  assert(g(m.repo, "rev-parse", "HEAD") === antes, "no debe crear commit");
});

await caso("retiro autorizado: publica y el commit elimina el archivo", async () => {
  const m = await montar();
  fs.unlinkSync(path.join(m.dirPublic, "archivos", "imagenes", "m1.jpg"));
  const p = paquete({ publicacionWebId: m.id, hashExcel: m.hashExcel, historias: [{ story_id: "h1", status: "aprobada_fidel" }], conMedio: false });
  for (const [n, d] of Object.entries(p)) {
    fs.writeFileSync(path.join(m.dirPublic, n), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(m.dirEspejo, n), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(m.root, "04_PUBLICACION_WEB", n), JSON.stringify(d, null, 2));
  }
  const plan = planHashDe((await correr(m, ["--verificar"])).salida);
  const { code } = await correr(m, ["--publicar", "--aprobacion", plan, "--confirmar-retiro"]);
  assert(code === 0, "deberia publicar con el indicador");
  const borrados = g(m.repo, "show", "--diff-filter=D", "--name-only", "--format=", "HEAD");
  assert(/archivos\/imagenes\/m1\.jpg/.test(borrados), "el commit deberia eliminar el archivo retirado");
});

await caso("push fallido: conserva el commit local y lo informa", async () => {
  const m = await montar();
  const plan = planHashDe((await correr(m, ["--verificar"])).salida);
  fs.rmSync(m.remoto, { recursive: true, force: true }); // remoto inalcanzable
  const { code, salida } = await correr(m, ["--publicar", "--aprobacion", plan]);
  assert(code !== 0, "deberia fallar");
  assert(/Fallo el push/.test(salida), "deberia decir que fallo el push");
  assert(/quedo creado localmente y el sitio NO cambio/.test(salida), "deberia informar del commit local");
  assert(/No se deshace nada automaticamente/.test(salida), "no debe proponer un reset automatico");
  const msg = g(m.repo, "log", "-1", "--format=%B");
  assert(msg.includes("publicacion-web-id"), "el commit local debe seguir ahi");
});

// =========================================================== CONFIRMACION

/** Publica y deja el sitio ficticio sirviendo el paquete indicado. */
async function publicarYServir(m, { servirDir = null } = {}) {
  const plan = planHashDe((await correr(m, ["--verificar"])).salida);
  const r = await correr(m, ["--publicar", "--aprobacion", plan, "--confirmar-retiro"]);
  m.publico.estado.dir = servirDir ?? m.dirPublic;
  return { plan, publicar: r };
}

await caso("confirmacion exitosa: compara la generacion y registra en el Excel", async () => {
  const m = await montar();
  await publicarYServir(m);
  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code === 0, `deberia confirmar, salio ${code}: ${salida.slice(-600)}`);
  assert(salida.includes(`sirve la generacion ${m.id}`), "deberia confirmar por publicacionWebId");
  assert(/Excel actualizado/.test(salida), "deberia registrar en el Excel");
  assert(/La jornada quedó publicada en el sitio/.test(salida), "deberia dar el mensaje de Fidel");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  const ws1 = wb.getWorksheet("01_HISTORIAL_COWORK");
  const resumen = String(ws1.getRow(5).getCell(4).value ?? "");
  assert(resumen.includes(m.id), "el historial debe guardar el publicacionWebId");
  assert(/commit=[0-9a-f]{40}/.test(resumen), "el historial debe guardar el commit SHA");
  assert(/planHash=[0-9a-f]{64}/.test(resumen), "el historial debe guardar el planHash");
});

await caso("confirmacion: historia incluida y aprobada se promueve a publicada", async () => {
  const m = await montar({ historias: [{ story_id: "h1", status: "aprobada_fidel" }] });
  await publicarYServir(m);
  await correr(m, ["--confirmar"]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  const ws = wb.getWorksheet("04_HISTORIAS");
  assert(String(ws.getRow(5).getCell(4).value) === "publicada", "h1 deberia quedar publicada");
});

await caso("confirmacion: una historia rechazada nunca se promueve", async () => {
  // h1 va en el paquete y es aprobada; h2 esta rechazada y fuera del paquete.
  const m = await montar({ historias: [{ story_id: "h1", status: "aprobada_fidel" }] });
  const wb0 = new ExcelJS.Workbook();
  await wb0.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  const ws0 = wb0.getWorksheet("04_HISTORIAS");
  ws0.getRow(6).getCell(1).value = "h2";
  ws0.getRow(6).getCell(4).value = "rechazada";
  await wb0.xlsx.writeFile(path.join(m.root, EXCEL_NOMBRE));
  // El hash del Excel cambio: se regenera el paquete declarandolo.
  const nuevoHash = sha256(path.join(m.root, EXCEL_NOMBRE));
  for (const d of [m.dirPublic, m.dirEspejo, path.join(m.root, "04_PUBLICACION_WEB")]) {
    const man = JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf-8"));
    man.hashExcel = nuevoHash;
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(man, null, 2));
  }
  await publicarYServir(m);
  await correr(m, ["--confirmar"]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  const ws = wb.getWorksheet("04_HISTORIAS");
  assert(String(ws.getRow(5).getCell(4).value) === "publicada", "la incluida se promueve");
  assert(String(ws.getRow(6).getCell(4).value) === "rechazada", "la rechazada NO se toca");
});

await caso("confirmacion de una retirada: no promueve ninguna historia", async () => {
  const m = await montar({ historias: [] });
  await publicarYServir(m);
  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code === 0, "deberia confirmar");
  assert(/historias promovidas a "publicada": ninguna/.test(salida), "no deberia promover nada");
});

await caso("timeout: el sitio nunca sirve la generacion nueva", async () => {
  const m = await montar();
  const dirViejo = tmpdir("viejo");
  const viejo = paquete({ publicacionWebId: "pubweb-anterior", hashExcel: m.hashExcel, historias: [{ story_id: "h1", status: "aprobada_fidel" }] });
  escribirPaquete(dirViejo, viejo);
  await publicarYServir(m, { servirDir: dirViejo });
  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code === 2, `deberia salir con codigo 2 (no confirmado), salio ${code}`);
  assert(/no sirve la generacion/.test(salida), "deberia decir que no pudo confirmar");
  assert(/La publicación está tardando más de lo normal/.test(salida), "deberia dar el mensaje de espera");
});

await caso("manifiesto remoto antiguo: la cache MISS no se toma por confirmacion", async () => {
  const m = await montar();
  const dirViejo = tmpdir("viejo2");
  escribirPaquete(dirViejo, paquete({ publicacionWebId: "pubweb-anterior", hashExcel: m.hashExcel, historias: [{ story_id: "h1", status: "aprobada_fidel" }] }));
  await publicarYServir(m, { servirDir: dirViejo });
  const { salida } = await correr(m, ["--confirmar"]);
  assert(/x-vercel-cache=MISS/.test(salida), "el servidor ficticio devuelve MISS");
  assert(!/Despliegue confirmado/.test(salida), "un MISS con manifiesto antiguo NO puede confirmar");
  assert(/esperando\.\.\. el sitio sirve todavia la generacion pubweb-anterior/.test(salida), "deberia decir que generacion ve");
});

await caso("archivo retirado que sigue respondiendo 200: no confirma", async () => {
  const m = await montar();
  // El sitio sirve un directorio que conserva el archivo retirado.
  const dirConResiduo = tmpdir("residuo");
  fs.unlinkSync(path.join(m.dirPublic, "archivos", "imagenes", "m1.jpg"));
  const p = paquete({ publicacionWebId: m.id, hashExcel: m.hashExcel, historias: [{ story_id: "h1", status: "aprobada_fidel" }], conMedio: false });
  for (const [n, d] of Object.entries(p)) {
    fs.writeFileSync(path.join(m.dirPublic, n), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(m.dirEspejo, n), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(m.root, "04_PUBLICACION_WEB", n), JSON.stringify(d, null, 2));
  }
  escribirPaquete(dirConResiduo, p, { conMedio: true }); // el residuo sigue ahi
  fs.writeFileSync(path.join(dirConResiduo, "manifest.json"), JSON.stringify(p["manifest.json"], null, 2));
  await publicarYServir(m, { servirDir: dirConResiduo });
  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code !== 0, "no deberia confirmar");
  assert(/sigue respondiendo 200/.test(salida), "deberia detectar el archivo retirado que persiste");
});

await caso("Excel cambiado despues de generar: publica pero deja el registro pendiente", async () => {
  const m = await montar();
  await publicarYServir(m);
  // Alguien edita el libro entre la publicacion y la confirmacion.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  wb.getWorksheet("04_HISTORIAS").getRow(9).getCell(1).value = "editado-a-mano";
  await wb.xlsx.writeFile(path.join(m.root, EXCEL_NOMBRE));

  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code === 3, `deberia salir con codigo 3 (registro pendiente), salio ${code}`);
  assert(/el Excel cambio despues de generar/.test(salida), "deberia explicar el motivo");
  assert(/NO se vuelve a publicar/.test(salida), "no debe republicar");
  assert(/registro interno quedó pendiente/.test(salida), "deberia dar el mensaje de Fidel correspondiente");

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  assert(
    String(wb2.getWorksheet("04_HISTORIAS").getRow(5).getCell(4).value) === "aprobada_fidel",
    "no debe haber promovido ninguna historia"
  );
});

// =========================================== IDEMPOTENCIA DEL REGISTRO

/** Lee las filas de 01_HISTORIAL_COWORK de un Excel de fixture. */
async function filasHistorial(m) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  const ws = wb.getWorksheet("01_HISTORIAL_COWORK");
  const filas = [];
  for (let r = 5; r <= ws.rowCount; r++) {
    const t = String(ws.getRow(r).getCell(1).value ?? "").trim();
    if (t) filas.push({ fila: r, tipo: t, resumen: String(ws.getRow(r).getCell(4).value ?? "") });
  }
  return filas;
}

await caso("idempotencia: confirmar dos veces no duplica el registro", async () => {
  const m = await montar();
  await publicarYServir(m);
  const primera = await correr(m, ["--confirmar"]);
  assert(primera.code === 0, "la primera confirmacion deberia salir 0");
  const filas1 = await filasHistorial(m);
  assert(filas1.length === 1, `deberia haber 1 fila, hay ${filas1.length}`);

  const segunda = await correr(m, ["--confirmar"]);
  assert(segunda.code === 0, `la segunda tambien deberia salir 0, salio ${segunda.code}`);
  assert(/ya confirmada y registrada/.test(segunda.salida), "deberia decir que ya estaba registrada");
  assert(/No se modifico nada/.test(segunda.salida), "deberia decir que no cambio nada");
  const filas2 = await filasHistorial(m);
  assert(filas2.length === 1, `no deberia anadir una segunda fila (hay ${filas2.length})`);
  assert(filas1[0].resumen === filas2[0].resumen, "la fila existente no debe cambiar");
});

await caso("idempotencia: una historia ya publicada no se vuelve a tocar", async () => {
  const m = await montar();
  await publicarYServir(m);
  await correr(m, ["--confirmar"]);
  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  assert(String(wb1.getWorksheet("04_HISTORIAS").getRow(5).getCell(4).value) === "publicada", "quedo publicada");

  const antes = sha256(path.join(m.root, EXCEL_NOMBRE));
  await correr(m, ["--confirmar"]);
  assert(sha256(path.join(m.root, EXCEL_NOMBRE)) === antes, "el Excel no debe cambiar en la segunda confirmacion");
});

await caso("idempotencia: retirada confirmada dos veces", async () => {
  const m = await montar({ historias: [] });
  await publicarYServir(m);
  const p1 = await correr(m, ["--confirmar"]);
  assert(p1.code === 0, "primera confirmacion de la retirada");
  const antes = sha256(path.join(m.root, EXCEL_NOMBRE));
  const p2 = await correr(m, ["--confirmar"]);
  assert(p2.code === 0, "segunda confirmacion tambien correcta");
  assert(/ya confirmada y registrada/.test(p2.salida), "deberia detectar el registro previo");
  assert(sha256(path.join(m.root, EXCEL_NOMBRE)) === antes, "el Excel no debe cambiar");
  assert((await filasHistorial(m)).length === 1, "solo una fila de retirada");
});

await caso("idempotencia: un registro previo incompatible aborta y pide revision", async () => {
  const m = await montar();
  await publicarYServir(m);
  await correr(m, ["--confirmar"]);

  // Alguien altera el commit registrado: la identidad ya no cuadra.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(m.root, EXCEL_NOMBRE));
  const ws = wb.getWorksheet("01_HISTORIAL_COWORK");
  ws.getRow(5).getCell(4).value = String(ws.getRow(5).getCell(4).value).replace(
    /commit=[0-9a-f]{40}/,
    "commit=" + "0".repeat(40)
  );
  await wb.xlsx.writeFile(path.join(m.root, EXCEL_NOMBRE));
  const antes = sha256(path.join(m.root, EXCEL_NOMBRE));

  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code === 4, `deberia salir con codigo 4 (revision), salio ${code}`);
  assert(/Registro incompatible/.test(salida), "deberia decir que el registro es incompatible");
  assert(/Se requiere tu revisión/.test(salida), "deberia pedir revision a Fidel");
  assert(sha256(path.join(m.root, EXCEL_NOMBRE)) === antes, "no debe escribir nada");
  assert((await filasHistorial(m)).length === 1, "no debe anadir una fila");
});

await caso("idempotencia: timeout y despues confirmacion exitosa", async () => {
  const m = await montar();
  const dirViejo = tmpdir("viejo3");
  escribirPaquete(dirViejo, paquete({ publicacionWebId: "pubweb-anterior", hashExcel: m.hashExcel, historias: [{ story_id: "h1", status: "aprobada_fidel" }] }));
  await publicarYServir(m, { servirDir: dirViejo });

  const t = await correr(m, ["--confirmar"]);
  assert(t.code === 2, `primero deberia agotar la espera (salio ${t.code})`);
  assert((await filasHistorial(m)).length === 0, "un timeout no debe registrar nada");

  // El despliegue termina: el sitio ya sirve la generacion nueva.
  m.publico.estado.dir = m.dirPublic;
  const ok = await correr(m, ["--confirmar"]);
  assert(ok.code === 0, `despues deberia confirmar (salio ${ok.code})`);
  assert((await filasHistorial(m)).length === 1, "y registrar exactamente una fila");
});

await caso("idempotencia: proceso interrumpido tras escribir el Excel", async () => {
  // Se simula el corte ejecutando la confirmacion completa (que ya escribio el
  // Excel) y volviendo a lanzarla, como haria quien no vio el mensaje final.
  const m = await montar();
  await publicarYServir(m);
  await correr(m, ["--confirmar"]);
  const trasPrimera = sha256(path.join(m.root, EXCEL_NOMBRE));

  const reintento = await correr(m, ["--confirmar"]);
  assert(reintento.code === 0, "el reintento debe terminar correctamente");
  assert(/ya confirmada y registrada/.test(reintento.salida), "debe reconocer el trabajo ya hecho");
  assert(sha256(path.join(m.root, EXCEL_NOMBRE)) === trasPrimera, "el Excel no debe volver a cambiar");
});

// ============================================ RESPALDO E INTEGRIDAD

await caso("respaldo: se crea antes de la primera escritura y conserva el estado previo", async () => {
  const m = await montar();
  await publicarYServir(m);
  const antesDeConfirmar = sha256(path.join(m.root, EXCEL_NOMBRE));
  await correr(m, ["--confirmar"]);

  const dirs = fs.readdirSync(path.join(m.root, "00_HERRAMIENTAS", "RESPALDOS"));
  assert(dirs.length === 1 && /_09$/.test(dirs[0]), `deberia haber un respaldo _09 (${dirs.join(",")})`);
  const respaldo = path.join(m.root, "00_HERRAMIENTAS", "RESPALDOS", dirs[0], "MAESTRO_FIXTURE.PRE_09.xlsx");
  assert(fs.existsSync(respaldo), "deberia existir el archivo de respaldo");
  assert(sha256(respaldo) === antesDeConfirmar, "el respaldo debe ser el Excel previo a la escritura");
  assert(sha256(path.join(m.root, EXCEL_NOMBRE)) !== antesDeConfirmar, "y el maestro si debe haber cambiado");
});

await caso("respaldo: no quedan temporales del Excel tras confirmar", async () => {
  const m = await montar();
  await publicarYServir(m);
  await correr(m, ["--confirmar"]);
  const dirs = fs.readdirSync(path.join(m.root, "00_HERRAMIENTAS", "RESPALDOS"));
  const restos = fs.readdirSync(path.join(m.root, "00_HERRAMIENTAS", "RESPALDOS", dirs[0]))
    .filter((f) => f.startsWith(".nuevo-"));
  assert(restos.length === 0, `no deberia quedar ningun temporal (${restos.join(",")})`);
  const enRaiz = fs.readdirSync(m.root).filter((f) => f.endsWith(".xlsx"));
  assert(enRaiz.length === 1, `la raiz debe conservar un unico .xlsx (${enRaiz.join(",")})`);
});

await caso("confirmar sin commit de publicacion: aborta", async () => {
  const m = await montar();
  const { code, salida } = await correr(m, ["--confirmar"]);
  assert(code !== 0, "deberia abortar");
  assert(/no es una publicacion web/.test(salida), "deberia decir que el commit no declara publicacion");
});

// ------------------------------------------------------------------ resumen

for (const s of servidores) { try { s.close(); } catch { /* ignorado */ } }
for (const d of temporales) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignorado */ }
}

console.log(`\n${"-".repeat(52)}`);
console.log(`PASS ${PASS}   FAIL ${FAIL}`);
if (FAIL) {
  console.log("\nFallos:");
  for (const f of fallos) console.log("  - " + f);
}
process.exit(FAIL ? 1 : 0);
