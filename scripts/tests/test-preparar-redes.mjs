// scripts/tests/test-preparar-redes.mjs
//
// Harness de la rutina 10 (preparar-publicacion-redes.mjs). No existia ninguno.
//
// Todo ocurre en directorios temporales y contra un servidor HTTP local que
// hace de Vercel: no toca la carpeta operativa real, no toca el Excel real y no
// sale a internet. La raiz de RUMBO del fixture vive deliberadamente en una
// ruta que NO contiene la palabra OneDrive.
//
//   node scripts/tests/test-preparar-redes.mjs            (todos)
//   node scripts/tests/test-preparar-redes.mjs <nombre>   (solo los que coincidan)

import { createRequire } from "node:module";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(AQUI, "../preparar-publicacion-redes.mjs");
const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));

let pass = 0;
const fallos = [];
const temporales = [];
const servidores = [];

function assert(cond, msg) {
  if (cond) pass++;
  else fallos.push(msg);
}

async function caso(nombre, fn) {
  if (ONLY.size > 0 && ![...ONLY].some((o) => nombre.includes(o))) return;
  try {
    await fn();
    console.log(`  ok  ${nombre}`);
  } catch (e) {
    fallos.push(`${nombre}: ${e && e.message}`);
    console.log(`  FALLO  ${nombre}: ${e && e.message}`);
  }
}

function tmpdir(sufijo) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `rumbo-redes-${sufijo}-`));
  temporales.push(d);
  return d;
}

const sha256 = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

// --- Servidor HTTP de fixture -----------------------------------------------
//
// Sirve el paquete web y permite programar respuestas por ruta: 404, 500, una
// redireccion, un MIME equivocado, un cuerpo distinto del mismo tamano, o no
// responder nunca. Cuenta peticiones por ruta para poder demostrar que un
// archivo compartido se descarga una sola vez.
function servir(dirPublico) {
  const reglas = new Map();
  const conteo = new Map();
  const srv = http.createServer((req, res) => {
    const ruta = decodeURIComponent(req.url.split("?")[0]);
    conteo.set(ruta, (conteo.get(ruta) || 0) + 1);
    const regla = reglas.get(ruta);
    if (regla === "colgar") return; // nunca responde: prueba el timeout
    if (regla && regla.status) {
      res.writeHead(regla.status, regla.headers || {});
      return res.end(regla.body || "");
    }
    const archivo = path.join(dirPublico, ruta.replace(/^\/+/, ""));
    if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      return res.end("no");
    }
    const ext = path.extname(archivo).toLowerCase();
    const mime = ext === ".jpg" ? "image/jpeg" : ext === ".mp4" ? "video/mp4" : "application/json";
    const buf = fs.readFileSync(archivo);
    res.writeHead(200, { "content-type": mime, "content-length": String(buf.length) });
    res.end(buf);
  });
  servidores.push(srv);
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${srv.address().port}`,
        reglas,
        conteo,
        cerrar: () => new Promise((r) => srv.close(r)),
      });
    });
  });
}

// --- Fixtures ---------------------------------------------------------------

const HOJAS = {
  "09_CONFIGURACION": ["config_key", "valor", "descripcion"],
  "03_CARRERAS": ["race_id", "status"],
  "04_HISTORIAS": ["story_id", "status"],
  "05_MEDIOS": ["media_id", "bitacora_id", "tipo_medio", "status", "licencia", "derechos_confirmados", "titulo", "descripcion", "location_source"],
  "17_BITACORA_ARCHIVOS": ["bitacora_id", "jornada_id", "nombre_original", "ubicacion_bitacora", "hash_copia_sha256", "autor", "ancho_pixeles", "alto_pixeles", "tipo_archivo"],
  "21_PUBLICACIONES_REDES": [
    "publicacion_id", "historia_id", "carrera_id", "media_ids", "publicar_facebook", "publicar_instagram",
    "formato_facebook", "formato_instagram", "texto_facebook", "texto_instagram", "aprobado_por",
    "fecha_aprobacion", "estado", "fecha_preparacion", "archivos", "hashes_sha256",
    "motivos_bloqueo_ultima_validacion", "facebook_estado", "instagram_estado",
    "facebook_intentos", "instagram_intentos", "facebook_post_id", "instagram_post_id",
  ],
  "01_HISTORIAL_COWORK": ["tipo_contenido", "destino", "titulo", "resumen", "id_origen", "resultado", "referencia_conversacion"],
};

async function escribirExcel(ruta, filas) {
  const wb = new ExcelJS.Workbook();
  for (const [nombre, cabeceras] of Object.entries(HOJAS)) {
    const ws = wb.addWorksheet(nombre);
    // Sin null inicial: en esta version de ExcelJS el indice 0 del array ya es
    // la columna 1, y un null delante desplazaba todo una columna — con lo que
    // readSheet, que salta las filas cuya columna 1 esta vacia, no leia nada.
    ws.getRow(4).values = [...cabeceras];
    const datos = filas[nombre] || [];
    datos.forEach((obj, i) => {
      ws.getRow(5 + i).values = cabeceras.map((c) => obj[c] ?? null);
    });
  }
  await wb.xlsx.writeFile(ruta);
}

function jpegFalso(bytes) {
  // Cabecera JPEG valida seguida de relleno: basta para el harness, que nunca
  // decodifica la imagen. Los fixtures reales de Meta son otra cosa.
  const b = Buffer.alloc(bytes, 0x20);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(b, 0);
  Buffer.from([0xff, 0xd9]).copy(b, bytes - 2);
  return b;
}

/**
 * Monta un escenario completo: carpeta RUMBO fuera de OneDrive, paquete web en
 * un public/ temporal, servidor HTTP y Excel de fixture.
 */
async function montar(opciones = {}) {
  const {
    esquema = "1.1",
    publicarFacebook = true,
    publicarInstagram = false,
    formatoFacebook = "fotos",
    formatoInstagram = null,
    medios = [{ id: "med-01", tipo: "fotografia", bytes: 2048 }],
    conManifiestoEspejo = true,
    confirmarPublicacionWeb = true,
    publicacionWebId = "pubweb-aaaabbbbccccdddd",
    enPaquete = null, // ids que SI estan en medios.json; null = todos
    derivadoInstagram = false,
    urlBase = null,
    configExtra = {},
  } = opciones;

  const base = tmpdir("caso");
  // La ruta NO contiene "OneDrive": es el punto de la migracion.
  const root = path.join(base, "Mi unidad", "Contratos", "RUMBO");
  const cwd = path.join(base, "codebase");
  for (const sub of ["01 ENTRADA", "02 BITACORA ORIGINAL", "03 TRABAJO COWORK", "04_PUBLICACION_WEB", "05_LISTOS_PUBLICAR", "06_PUBLICADOS", "07_PUBLICADOS_PARCIAL", "08_ERRORES"]) {
    fs.mkdirSync(path.join(root, sub), { recursive: true });
  }
  const publicDir = path.join(cwd, "public", "data", "rumbo");
  fs.mkdirSync(path.join(publicDir, "archivos", "imagenes"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "archivos", "videos"), { recursive: true });
  fs.mkdirSync(path.join(cwd, "src", "data", "generated", "rumbo-web"), { recursive: true });

  const mediosJson = [];
  const filasMedios = [];
  const filasBitacora = [];
  for (const m of medios) {
    const carpeta = m.tipo === "video" ? "videos" : "imagenes";
    const ext = m.tipo === "video" ? ".mp4" : ".jpg";
    const nombreWeb = `${m.id}${ext}`;
    const buf = m.tipo === "video" ? Buffer.alloc(m.bytes ?? 2048, 0x11) : jpegFalso(m.bytes ?? 2048);

    // original en la bitacora, con subcarpeta por jornada (como en la operacion real)
    const relFuente = m.sinRutaFuente
      ? ""
      : `RUMBO/02 BITACORA ORIGINAL/2026-07-20-PRUEBA/${m.id}_original${ext}`;
    if (relFuente && !m.fuenteInexistente) {
      const abs = path.join(root, "..", relFuente);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, buf);
    }

    const incluir = enPaquete === null || enPaquete.includes(m.id);
    if (incluir) {
      fs.writeFileSync(path.join(publicDir, "archivos", carpeta, nombreWeb), buf);
      const registro = { mediaId: m.id, tipo: m.tipo, rutaWeb: `archivos/${carpeta}/${nombreWeb}`, instagram: null };
      if (m.tipo === "fotografia" && derivadoInstagram) {
        const nombreIg = `${m.id}__instagram.jpg`;
        fs.writeFileSync(path.join(publicDir, "archivos", "imagenes", nombreIg), jpegFalso((m.bytes ?? 2048) + 16));
        registro.instagram = { requiereDerivado: true, rutaWebInstagram: `archivos/imagenes/${nombreIg}` };
      }
      mediosJson.push(registro);
    }

    filasMedios.push({
      media_id: m.id,
      bitacora_id: `bit-${m.id}`,
      tipo_medio: m.tipo,
      status: "published",
      licencia: "propia",
      derechos_confirmados: "Sí",
    });
    filasBitacora.push({
      bitacora_id: `bit-${m.id}`,
      jornada_id: "jor-prueba",
      nombre_original: `${m.id}_original${ext}`,
      ubicacion_bitacora: relFuente,
      hash_copia_sha256: null,
      autor: "Fidel",
      tipo_archivo: m.tipo,
    });
  }

  const manifest = { publicacionWebId, generadoEn: new Date().toISOString(), conteos: {} };
  fs.writeFileSync(path.join(publicDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(publicDir, "medios.json"), JSON.stringify({ medios: mediosJson }, null, 2));
  if (conManifiestoEspejo) {
    fs.writeFileSync(
      path.join(cwd, "src", "data", "generated", "rumbo-web", "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
  }

  const srv = await servir(publicDir.replace(path.join("data", "rumbo"), path.join("data", "rumbo")));
  // El servidor sirve desde publicDir; las URL llevan el prefijo /data/rumbo/.
  await srv.cerrar();
  const srv2 = await servir(path.join(cwd, "public"));
  const sitio = urlBase ?? srv2.url;

  const filas = {
    "09_CONFIGURACION": [
      { config_key: "site_public_base_url", valor: sitio },
      ...(esquema === null ? [] : [{ config_key: "schema_marcador_redes_activo", valor: esquema }]),
      ...Object.entries(configExtra).map(([k, v]) => ({ config_key: k, valor: v })),
    ],
    "03_CARRERAS": [{ race_id: "race-01", status: "confirmada" }],
    "04_HISTORIAS": [{ story_id: "sto-01", status: "aprobada_fidel" }],
    "05_MEDIOS": filasMedios,
    "17_BITACORA_ARCHIVOS": filasBitacora,
    "21_PUBLICACIONES_REDES": [
      {
        publicacion_id: "pub-01",
        historia_id: "sto-01",
        media_ids: medios.map((m) => m.id).join(", "),
        publicar_facebook: publicarFacebook ? "Sí" : "No",
        publicar_instagram: publicarInstagram ? "Sí" : "No",
        formato_facebook: formatoFacebook,
        formato_instagram: formatoInstagram,
        texto_facebook: "Texto de Facebook",
        texto_instagram: "Texto de Instagram",
        aprobado_por: "Fidel",
        fecha_aprobacion: "2026-07-21",
        estado: "borrador",
      },
    ],
    "01_HISTORIAL_COWORK": confirmarPublicacionWeb
      ? [
          {
            tipo_contenido: "publicacion_web",
            id_origen: publicacionWebId,
            resultado: "despliegue confirmado; historias promovidas: ninguna",
            referencia_conversacion: "rutina_09",
          },
        ]
      : [],
  };
  const excelPath = path.join(root, "MAESTRO_FIXTURE.xlsx");
  await escribirExcel(excelPath, filas);

  return { base, root, cwd, publicDir, excelPath, servidor: srv2, sitio, listos: path.join(root, "05_LISTOS_PUBLICAR") };
}

function correr(m, args = [], extraEnv = {}) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: m.cwd,
      env: { ...process.env, RUMBO_ONEDRIVE_ROOT: m.root, ...extraEnv },
      encoding: "utf-8",
    });
    let out = "";
    let err = "";
    hijo.stdout.on("data", (d) => (out += d));
    hijo.stderr.on("data", (d) => (err += d));
    hijo.on("close", (code) => resolve({ code, out, err, todo: out + err }));
  });
}

const marcadorDe = (m) => path.join(m.listos, "LISTO_PARA_PUBLICAR__pub-01.json");
const leerMarcador = (m) => JSON.parse(fs.readFileSync(marcadorDe(m), "utf-8"));
const contenidoListos = (m) => fs.readdirSync(m.listos).sort();

// --- Casos ------------------------------------------------------------------

console.log("\n== Rutina 10: esquema, rendiciones y verificacion remota ==\n");

await caso("1 · raiz de Drive sin la palabra OneDrive: se prepara igual", async () => {
  const m = await montar();
  assert(!m.root.includes("OneDrive"), "la raiz del fixture no debe contener OneDrive");
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `esperaba exito, salida:\n${r.todo}`);
  assert(!/onedrive|my_drive/i.test(r.todo), "ningun motivo debe mencionar OneDrive");
  assert(fs.existsSync(marcadorDe(m)), "debe crearse el marcador");
  await m.servidor.cerrar();
});

await caso("2 · esquema 1.1: en 05 queda exactamente un JSON y ningun binario", async () => {
  const m = await montar({ medios: [{ id: "med-01", tipo: "fotografia" }, { id: "med-02", tipo: "fotografia" }] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `esperaba exito:\n${r.todo}`);
  const dentro = contenidoListos(m);
  assert(dentro.length === 1, `05 debe tener 1 archivo, tiene ${dentro.length}: ${dentro.join(", ")}`);
  assert(dentro[0].endsWith(".json"), `el unico archivo debe ser JSON, es ${dentro[0]}`);
  assert(!dentro.some((f) => /\.(jpg|mp4)$/i.test(f)), "no debe haber binarios en 05");
  await m.servidor.cerrar();
});

await caso("3 · esquema 1.1: listas por red, media_source y fuente", async () => {
  const m = await montar({ publicarInstagram: true, formatoInstagram: "foto", medios: [{ id: "med-01", tipo: "fotografia" }] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `esperaba exito:\n${r.todo}`);
  const j = leerMarcador(m);
  assert(j.schema_version === "1.1", `schema_version debe ser 1.1, es ${j.schema_version}`);
  assert(j.media_source === "public_url", "media_source debe declarar public_url");
  assert(Array.isArray(j.facebook_media) && j.facebook_media.length === 1, "facebook_media debe ser lista de 1");
  assert(Array.isArray(j.instagram_media) && j.instagram_media.length === 1, "instagram_media debe ser lista de 1");
  const f = j.facebook_media[0];
  for (const campo of ["orden", "media_id", "nombre_archivo", "url_publica", "mime_type", "tamano_bytes", "sha256"]) {
    assert(f[campo] !== undefined && f[campo] !== null, `falta ${campo} en la rendicion`);
  }
  assert(j.medios[0].fuente.ruta_fuente_relativa.startsWith("RUMBO/02 BITACORA ORIGINAL/"), "la fuente debe ser la ruta registrada");
  assert(j.medios[0].url_publica === undefined, "medios[] es inventario: no lleva URL");
  assert(!/ruta_onedrive/.test(JSON.stringify(j)), "1.1 no debe contener ruta_onedrive");
  await m.servidor.cerrar();
});

await caso("4 · red desactivada: su lista existe y esta vacia, nunca ausente", async () => {
  const m = await montar({ publicarInstagram: false });
  await correr(m, ["--publicacion-id=pub-01"]);
  const j = leerMarcador(m);
  assert(Array.isArray(j.instagram_media), "instagram_media debe existir aunque la red este desactivada");
  assert(j.instagram_media.length === 0, "y debe estar vacia");
  await m.servidor.cerrar();
});

await caso("5 · Instagram con derivado: URL distinta de la de Facebook", async () => {
  const m = await montar({ publicarInstagram: true, formatoInstagram: "foto", derivadoInstagram: true });
  await correr(m, ["--publicacion-id=pub-01"]);
  const j = leerMarcador(m);
  const fb = j.facebook_media[0].url_publica;
  const ig = j.instagram_media[0].url_publica;
  assert(fb !== ig, "Facebook no debe recibir la version recortada de Instagram");
  assert(ig.includes("__instagram"), `la URL de Instagram debe ser el derivado, es ${ig}`);
  assert(j.facebook_media[0].sha256 !== j.instagram_media[0].sha256, "cada rendicion tiene su propio hash");
  await m.servidor.cerrar();
});

await caso("6 · archivo compartido: se descarga una sola vez", async () => {
  const m = await montar({ publicarInstagram: true, formatoInstagram: "foto", derivadoInstagram: false });
  await correr(m, ["--publicacion-id=pub-01"]);
  const j = leerMarcador(m);
  assert(j.facebook_media[0].url_publica === j.instagram_media[0].url_publica, "el fixture debe compartir archivo");
  const ruta = new URL(j.facebook_media[0].url_publica).pathname;
  assert(m.servidor.conteo.get(ruta) === 1, `esperaba 1 peticion, hubo ${m.servidor.conteo.get(ruta)}`);
  await m.servidor.cerrar();
});

await caso("7 · medio ausente del paquete web", async () => {
  const m = await montar({ enPaquete: [] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/medio_no_esta_en_el_paquete_web/.test(r.todo), `esperaba el motivo:\n${r.todo}`);
  assert(contenidoListos(m).length === 0, "05 debe quedar intacta");
  await m.servidor.cerrar();
});

await caso("8 · URL que devuelve 404 (jornada retirada)", async () => {
  const m = await montar();
  const j = { pathname: `/data/rumbo/archivos/imagenes/med-01.jpg` };
  m.servidor.reglas.set(j.pathname, { status: 404 });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/url_publica_no_responde:med-01:404/.test(r.todo), `esperaba 404:\n${r.todo}`);
  assert(contenidoListos(m).length === 0, "05 debe quedar intacta");
  await m.servidor.cerrar();
});

await caso("9 · respuesta 500", async () => {
  const m = await montar();
  m.servidor.reglas.set("/data/rumbo/archivos/imagenes/med-01.jpg", { status: 500 });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(/url_publica_no_responde:med-01:500/.test(r.todo), `esperaba 500:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("10 · redireccion 301 hacia algo que si responde: bloquea igual", async () => {
  const m = await montar();
  m.servidor.reglas.set("/data/rumbo/archivos/imagenes/med-01.jpg", {
    status: 301,
    headers: { location: "/data/rumbo/manifest.json" },
  });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "una redireccion debe bloquear");
  assert(/url_publica_no_responde:med-01:301/.test(r.todo), `esperaba 301 sin seguir:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("11 · MIME incoherente", async () => {
  const m = await montar();
  m.servidor.reglas.set("/data/rumbo/archivos/imagenes/med-01.jpg", {
    status: 200,
    headers: { "content-type": "text/html" },
    body: "<html>no soy una foto</html>",
  });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(/mime_remoto_incoherente:med-01/.test(r.todo), `esperaba MIME incoherente:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("12 · mismo tamano y MIME pero contenido distinto: lo caza el hash", async () => {
  const m = await montar({ medios: [{ id: "med-01", tipo: "fotografia", bytes: 4096 }] });
  const distinto = jpegFalso(4096);
  distinto[100] = 0x7f; // un byte diferente, mismo tamano
  m.servidor.reglas.set("/data/rumbo/archivos/imagenes/med-01.jpg", {
    status: 200,
    headers: { "content-type": "image/jpeg", "content-length": String(distinto.length) },
    body: distinto,
  });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/url_publica_hash_no_coincide:med-01/.test(r.todo), `el hash debe detectarlo:\n${r.todo}`);
  assert(/URL\s*:/.test(r.todo) && /esperado/.test(r.todo), "el fallo debe registrar URL y hashes");
  await m.servidor.cerrar();
});

await caso("13 · el servidor no responde: corta por timeout y no cuelga", async () => {
  const m = await montar();
  m.servidor.reglas.set("/data/rumbo/archivos/imagenes/med-01.jpg", "colgar");
  const r = await correr(m, ["--publicacion-id=pub-01"], { RUMBO_TIMEOUT_PETICION_MS: "800" });
  assert(r.code !== 0, "debe bloquear");
  assert(/url_publica_no_responde:med-01:timeout/.test(r.todo), `esperaba timeout:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("14 · cuerpo mayor que el maximo permitido", async () => {
  const m = await montar({ medios: [{ id: "med-01", tipo: "fotografia", bytes: 30000 }] });
  const r = await correr(m, ["--publicacion-id=pub-01"], { RUMBO_MAX_BYTES_MEDIO: "5000" });
  assert(r.code !== 0, "debe bloquear");
  assert(/medio_excede_tamano:med-01/.test(r.todo), `esperaba exceso de tamano:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("15 · publicacion web sin confirmar: aborto global", async () => {
  const m = await montar({ confirmarPublicacionWeb: false });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/publicacion_web_no_confirmada/.test(r.todo), `esperaba el motivo:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("16 · manifiesto local y espejo de generaciones distintas", async () => {
  const m = await montar();
  fs.writeFileSync(
    path.join(m.cwd, "src", "data", "generated", "rumbo-web", "manifest.json"),
    JSON.stringify({ publicacionWebId: "pubweb-0000000000000000" })
  );
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(/generacion_web_desfasada/.test(r.todo), `esperaba desfase:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("17 · formato post con una fotografia: bloquea", async () => {
  const m = await montar({ formatoFacebook: "post" });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/formato_post_no_admite_medios/.test(r.todo), `esperaba el motivo nuevo:\n${r.todo}`);
  assert(contenidoListos(m).length === 0, "no debe crearse marcador");
  await m.servidor.cerrar();
});

await caso("18 · formato post sin medios: valido", async () => {
  const m = await montar({ formatoFacebook: "post", medios: [] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `post sin medios debe prepararse:\n${r.todo}`);
  const j = leerMarcador(m);
  assert(j.facebook_media.length === 0, "sin medios, la lista va vacia");
  await m.servidor.cerrar();
});

await caso("19 · formato fotos con una sola imagen: valido", async () => {
  const m = await montar({ formatoFacebook: "fotos", medios: [{ id: "med-01", tipo: "fotografia" }] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `una foto sola tambien es formato fotos:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("20 · formato fotos con imagen y video: bloquea", async () => {
  const m = await montar({
    formatoFacebook: "fotos",
    medios: [{ id: "med-01", tipo: "fotografia" }, { id: "med-02", tipo: "video" }],
  });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/formato_facebook_incompatible_con_medios/.test(r.todo), `esperaba incompatibilidad:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("21 · formato video con dos videos, y reel con una imagen: bloquean", async () => {
  const a = await montar({
    formatoFacebook: "video",
    medios: [{ id: "med-01", tipo: "video" }, { id: "med-02", tipo: "video" }],
  });
  const ra = await correr(a, ["--publicacion-id=pub-01"]);
  assert(ra.code !== 0 && /formato_facebook_incompatible/.test(ra.todo), `video con dos videos debe bloquear:\n${ra.todo}`);
  await a.servidor.cerrar();

  const b = await montar({ formatoFacebook: "reel", medios: [{ id: "med-01", tipo: "fotografia" }] });
  const rb = await correr(b, ["--publicacion-id=pub-01"]);
  assert(rb.code !== 0 && /formato_facebook_incompatible/.test(rb.todo), `reel con imagen debe bloquear:\n${rb.todo}`);
  await b.servidor.cerrar();
});

await caso("22 · esquema 1.0: contrato historico intacto y binarios en 05", async () => {
  const m = await montar({ esquema: "1.0" });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `1.0 debe seguir funcionando:\n${r.todo}`);
  const j = leerMarcador(m);
  assert(j.schema_version === "1.0", `esperaba 1.0, es ${j.schema_version}`);
  assert(j.media_source === undefined, "1.0 no lleva media_source");
  assert(j.facebook_media === undefined && j.instagram_media === undefined, "1.0 no lleva listas por red");
  assert("ruta_onedrive" in j.medios[0], "1.0 debe conservar ruta_onedrive en medios[]");
  assert(j.medios[0].url_publica !== undefined, "1.0 conserva url_publica dentro de medios[]");
  const dentro = contenidoListos(m);
  assert(dentro.some((f) => f.endsWith(".jpg")), `1.0 debe copiar binarios a 05: ${dentro.join(", ")}`);
  await m.servidor.cerrar();
});

await caso("23 · celda de esquema ausente: se niega a ejecutarse", async () => {
  const m = await montar({ esquema: null });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe abortar");
  assert(/No hay version activa del marcador/.test(r.todo), `esperaba aborto explicito:\n${r.todo}`);
  assert(/schema_marcador_redes_activo/.test(r.todo), "el mensaje debe decir que celda mirar");
  assert(!/LISTA PARA PUBLICAR/.test(r.todo), "no debe preparar nada con la celda vacia");
  await m.servidor.cerrar();
});

await caso("24 · esquema desconocido: no degrada a la version mas cercana", async () => {
  const m = await montar({ esquema: "1.2" });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe abortar");
  assert(/no soportada/.test(r.todo), `esperaba rechazo:\n${r.todo}`);
  assert(/No se degrada/.test(r.todo), "debe decir explicitamente que no degrada");
  await m.servidor.cerrar();
});

await caso("25 · --esquema sin modo de prueba: se ignora y manda el Excel", async () => {
  const m = await montar({ esquema: "1.1" });
  const r = await correr(m, ["--publicacion-id=pub-01", "--esquema=1.0"]);
  assert(r.code === 0, `deberia prepararse:\n${r.todo}`);
  const j = leerMarcador(m);
  assert(j.schema_version === "1.1", `el Excel manda: esperaba 1.1, es ${j.schema_version}`);
  await m.servidor.cerrar();
});

await caso("26 · --esquema con modo de prueba: sustituye la celda", async () => {
  const m = await montar({ esquema: "1.1" });
  const r = await correr(m, ["--publicacion-id=pub-01", "--modo-prueba", "--esquema=1.0"]);
  assert(r.code === 0, `deberia prepararse:\n${r.todo}`);
  assert(leerMarcador(m).schema_version === "1.0", "en modo de prueba el argumento manda");
  await m.servidor.cerrar();
});

await caso("27 · RUMBO_SITE_BASE_URL sin modo de prueba: aborta", async () => {
  const m = await montar();
  const r = await correr(m, ["--publicacion-id=pub-01"], { RUMBO_SITE_BASE_URL: "http://otro.example" });
  assert(r.code !== 0, "debe abortar");
  assert(/solo pueden usarse con --modo-prueba/.test(r.todo), `esperaba la compuerta:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("28 · ubicacion_bitacora vacia: aviso, no bloqueo, y sin bloque fuente", async () => {
  const m = await montar({ medios: [{ id: "med-01", tipo: "fotografia", sinRutaFuente: true }] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code === 0, `no debe bloquear:\n${r.todo}`);
  assert(/sin_ruta_fuente_registrada/.test(r.todo), "debe avisar");
  const j = leerMarcador(m);
  assert(j.medios[0].fuente === undefined, "sin ruta real, el bloque fuente se omite");
  await m.servidor.cerrar();
});

await caso("29 · ubicacion_bitacora que no existe en disco: bloquea", async () => {
  const m = await montar({ medios: [{ id: "med-01", tipo: "fotografia", fuenteInexistente: true }] });
  const r = await correr(m, ["--publicacion-id=pub-01"]);
  assert(r.code !== 0, "debe bloquear");
  assert(/archivo_faltante_en_disco/.test(r.todo), `esperaba el motivo:\n${r.todo}`);
  await m.servidor.cerrar();
});

await caso("30 · --validar no toca el Excel ni ninguna carpeta", async () => {
  const m = await montar();
  const antesExcel = sha256(m.excelPath);
  const antesListos = contenidoListos(m).join("|");
  const antesPublic = fs.readdirSync(path.join(m.publicDir, "archivos", "imagenes")).sort().join("|");
  await correr(m, ["--validar"]);
  assert(sha256(m.excelPath) === antesExcel, "el Excel no debe cambiar en --validar");
  assert(contenidoListos(m).join("|") === antesListos, "05 no debe cambiar");
  assert(fs.readdirSync(path.join(m.publicDir, "archivos", "imagenes")).sort().join("|") === antesPublic, "public/ no debe cambiar");
  await m.servidor.cerrar();
});

await caso("31 · tras un bloqueo no queda ningun .preparando__", async () => {
  const m = await montar({ enPaquete: [] });
  await correr(m, ["--publicacion-id=pub-01"]);
  const dentro = contenidoListos(m);
  assert(!dentro.some((f) => f.startsWith(".preparando__")), `quedo un temporal: ${dentro.join(", ")}`);
  assert(dentro.length === 0, `05 debe quedar vacia: ${dentro.join(", ")}`);
  await m.servidor.cerrar();
});

await caso("32 · limpiarClavesObsoletas: limpia fuera de OneDrive, conserva dentro", async () => {
  const { limpiarClavesObsoletas } = await import("../lib/rumbo-root.mjs");
  const RUTA_DRIVE = "D:" + path.sep + "Mi unidad" + path.sep + "RUMBO";
  const fuera = { rumboRoot: RUTA_DRIVE, myDriveRelativeRoot: "/Contratos/viejo/RUMBO" };
  assert(limpiarClavesObsoletas(fuera, { raiz: RUTA_DRIVE }).length === 1, "fuera de OneDrive debe limpiar");
  assert(fuera.myDriveRelativeRoot === undefined, "la clave obsoleta debe desaparecer");
  assert(fuera.rumboRoot === RUTA_DRIVE, "la raiz no se toca");

  const RUTA_OD = "C:" + path.sep + "Users" + path.sep + "x" + path.sep + "OneDrive" + path.sep + "RUMBO";
  const dentro = { rumboRoot: RUTA_OD, myDriveRelativeRoot: "/x/RUMBO" };
  assert(limpiarClavesObsoletas(dentro, { raiz: RUTA_OD }).length === 0, "en OneDrive NO debe limpiar");
  assert(dentro.myDriveRelativeRoot === "/x/RUMBO", "la clave debe conservarse para el rollback a 1.0");
});

// --- Aislamiento de configurar-rumbo -----------------------------------------
//
// El flujo COMPLETO se ejecuta contra un codebase temporal inyectado con
// --codebase=, no contra el real. Ninguna de estas pruebas calcula su destino
// desde la ubicacion del modulo: si lo hiciera, volveria a pisar el
// rumbo.config.json de quien ejecute la suite, que es el incidente que estas
// pruebas existen para impedir que se repita.

/** Crea un codebase temporal y una raiz operativa ficticia bajo la nube pedida. */
function codebaseYRaiz(nombreNube) {
  const base = tmpdir("cfg");
  const codebase = path.join(base, "codebase");
  fs.mkdirSync(codebase, { recursive: true });
  const root = path.join(base, nombreNube, "Contratos", "RUMBO");
  for (const sub of ["04_PUBLICACION_WEB", "05_LISTOS_PUBLICAR"]) {
    fs.mkdirSync(path.join(root, sub), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "MAESTRO_FIXTURE.xlsx"), "fixture");
  return { codebase, root, cfg: path.join(codebase, "rumbo.config.json") };
}

function correrConfigurar(args, cwd) {
  const guion = path.resolve(AQUI, "../configurar-rumbo.mjs");
  return new Promise((resolve) => {
    const h = spawn(process.execPath, [guion, ...args], { cwd: cwd || process.cwd() });
    let out = "";
    h.stdout.on("data", (d) => (out += d));
    h.stderr.on("data", (d) => (out += d));
    h.on("close", (code) => resolve({ code, out }));
  });
}

await caso("33 · flujo completo contra un codebase temporal inyectado", async () => {
  const { codebase, root, cfg } = codebaseYRaiz("Mi unidad");
  const r = await correrConfigurar([root, "--modo-prueba", `--codebase=${codebase}`]);
  assert(r.code === 0, `esperaba exito:
${r.out}`);
  assert(fs.existsSync(cfg), "debe escribir la configuracion en el codebase temporal");
  const escrito = JSON.parse(fs.readFileSync(cfg, "utf-8"));
  assert(escrito.rumboRoot === root, "debe guardar la raiz indicada");
});

await caso("34 · --codebase fuera de modo de prueba: rechazado y sin escribir", async () => {
  const { codebase, root, cfg } = codebaseYRaiz("Mi unidad");
  const r = await correrConfigurar([root, `--codebase=${codebase}`]);
  assert(r.code !== 0, "debe abortar");
  assert(/solo puede usarse junto con --modo-prueba/.test(r.out), `esperaba el rechazo:
${r.out}`);
  assert(!fs.existsSync(cfg), "no debe haber escrito nada en el destino alternativo");
});

await caso("35 · elimina myDriveRelativeRoot solo si la raiz nueva no es OneDrive", async () => {
  const { codebase, root, cfg } = codebaseYRaiz("Mi unidad");
  fs.writeFileSync(cfg, JSON.stringify({ rumboRoot: "viejo", myDriveRelativeRoot: "/Contratos/viejo/RUMBO" }, null, 2));
  const r = await correrConfigurar([root, "--modo-prueba", `--codebase=${codebase}`]);
  assert(r.code === 0, `esperaba exito:
${r.out}`);
  const escrito = JSON.parse(fs.readFileSync(cfg, "utf-8"));
  assert(escrito.myDriveRelativeRoot === undefined, "fuera de OneDrive la clave debe eliminarse");
  assert(/Limpiadas/.test(r.out), "debe informarlo por consola");
});

await caso("36 · conserva myDriveRelativeRoot mientras la raiz sigue en OneDrive", async () => {
  const { codebase, root, cfg } = codebaseYRaiz("OneDrive");
  fs.writeFileSync(cfg, JSON.stringify({ rumboRoot: "viejo", myDriveRelativeRoot: "/Contratos/vigente/RUMBO" }, null, 2));
  const r = await correrConfigurar([root, "--modo-prueba", `--codebase=${codebase}`]);
  assert(r.code === 0, `esperaba exito:
${r.out}`);
  const escrito = JSON.parse(fs.readFileSync(cfg, "utf-8"));
  assert(
    escrito.myDriveRelativeRoot === "/Contratos/vigente/RUMBO",
    "en OneDrive la clave debe conservarse: el rollback a 1.0 la necesita"
  );
  assert(!/Limpiadas/.test(r.out), "no debe informar de una limpieza que no hizo");
});

await caso("37 · una raiz invalida no deja rastro en el destino", async () => {
  const { codebase, cfg } = codebaseYRaiz("Mi unidad");
  const inexistente = path.join(codebase, "no-existe", "RUMBO");
  const r = await correrConfigurar([inexistente, "--modo-prueba", `--codebase=${codebase}`]);
  assert(r.code !== 0, "debe abortar");
  assert(!fs.existsSync(cfg), "no debe crear configuracion con una raiz invalida");
  const sueltos = fs.readdirSync(codebase).filter((f) => f.startsWith(".rumbo.config.json"));
  assert(sueltos.length === 0, `no debe dejar temporales: ${sueltos.join(", ")}`);
});

await caso("38 · escritura atomica: no deja temporales tras un exito", async () => {
  const { codebase, root } = codebaseYRaiz("Mi unidad");
  await correrConfigurar([root, "--modo-prueba", `--codebase=${codebase}`]);
  const sueltos = fs.readdirSync(codebase).filter((f) => f.startsWith(".rumbo.config.json"));
  assert(sueltos.length === 0, `quedaron temporales: ${sueltos.join(", ")}`);
});

// Volcado de muestra: escribe los dos marcadores del MISMO fixture para poder
// compararlos campo a campo. Solo con --volcar, para no ensuciar las pruebas.
if (process.argv.includes("--volcar")) {
  const destino = process.argv[process.argv.indexOf("--volcar") + 1] || ".";
  for (const esquema of ["1.0", "1.1"]) {
    const m = await montar({
      esquema,
      publicarInstagram: true,
      formatoInstagram: "carrusel",
      formatoFacebook: "fotos",
      derivadoInstagram: true,
      medios: [
        { id: "med-20260720-turi-01", tipo: "fotografia", bytes: 2048 },
        { id: "med-20260720-turi-02", tipo: "fotografia", bytes: 3072 },
      ],
    });
    await correr(m, ["--publicacion-id=pub-01"]);
    const origen = path.join(m.listos, "LISTO_PARA_PUBLICAR__pub-01.json");
    if (fs.existsSync(origen)) {
      fs.copyFileSync(origen, path.join(destino, `marcador-${esquema}.json`));
      fs.writeFileSync(
        path.join(destino, `contenido-05-${esquema}.txt`),
        contenidoListos(m).join("\n") + "\n"
      );
    }
    await m.servidor.cerrar();
  }
  console.log("volcado hecho");
}

// --- Cierre -----------------------------------------------------------------

for (const s of servidores) {
  try {
    s.close();
  } catch {}
}
for (const d of temporales) {
  try {
    fs.rmSync(d, { recursive: true, force: true });
  } catch {}
}

console.log(`\nPASS ${pass}   FAIL ${fallos.length}`);
if (fallos.length > 0) {
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
}
