// scripts/tests/test-publicables.mjs
//
// Pruebas de D1: que el estado editorial del Excel gobierne de verdad lo que
// llega al paquete web, y que los archivos de una generacion anterior no
// sobrevivan cuando su contenido deja de ser publicable.
//
// Usa SOLO fixtures en un directorio temporal: construye un Excel ficticio, una
// carpeta operativa ficticia y un codebase ficticio, y ejecuta el CLI real como
// proceso hijo. No toca la operacion, ni el Excel real, ni el repositorio.

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sustituir, validarDirectorio } from "../lib/reemplazo-atomico.mjs";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../sync-rumbo.mjs");
const EXCEL_NOMBRE = "MAESTRO_FIXTURE.xlsx";

const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));
let PASS = 0;
let FAIL = 0;
const fallos = [];
const temporales = [];

function assert(cond, msg) {
  if (cond) PASS++;
  else {
    FAIL++;
    fallos.push(msg);
    console.log("   x " + msg);
  }
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

// ---------------------------------------------------------------- fixtures

const HOJAS = {
  "09_CONFIGURACION": ["config_key", "valor", "obligatorio", "quien_lo_completa", "explicacion", "ejemplo"],
  "02_JORNADAS": ["jornada_id", "fecha", "provincia", "canton", "race_id", "route_id"],
  "03_CARRERAS": ["race_id", "slug", "titulo", "fecha", "location_id", "descripcion_corta", "route_id", "cover_photo_id", "status"],
  "04_HISTORIAS": ["story_id", "slug", "tipo", "titulo", "fecha", "location_id", "resumen", "cover_photo_id", "status", "source_material_ids", "contenido_completo"],
  "05_MEDIOS": ["media_id", "tipo_medio", "slug", "titulo", "archivo_nombre", "status", "bitacora_id", "licencia", "derechos_confirmados"],
  "06_RUTAS": ["route_id", "race_id", "race_required", "canton_id", "distancia_km", "geojson_onedrive_path", "source_route_bitacora_id"],
  "08_RELACIONES": ["relation_id", "asset_type", "asset_id", "destination_type", "destination_id", "role", "display_order", "profile_section", "status", "notes"],
  "15_PROVINCIAS": ["INDICADOR", "VALOR"],
  "16_TERRITORIO": ["territory_id", "provincia", "canton_municipio"],
  "17_BITACORA_ARCHIVOS": ["bitacora_id", "jornada_id", "media_id", "nombre_original", "tipo_archivo", "ubicacion_bitacora", "canton_id", "hash_copia_sha256", "public_status"],
  "19_ARCHIVOS_DERIVADOS": ["derived_id", "source_bitacora_id", "derived_type", "generated_by"],
  "20_METRICAS_ATLETA": ["tipo_metrica", "valor", "fecha_hora", "status"],
};

function tmpdir(prefijo) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `rumbo-d1-${prefijo}-`));
  temporales.push(d);
  return d;
}

/** Escribe el Excel ficticio con las filas dadas por hoja. */
async function escribirExcel(rutaExcel, datos) {
  const wb = new ExcelJS.Workbook();
  for (const [hoja, headers] of Object.entries(HOJAS)) {
    const ws = wb.addWorksheet(hoja);
    ws.getCell("A1").value = hoja;
    headers.forEach((h, i) => (ws.getRow(4).getCell(i + 1).value = h));
    const filas = datos[hoja] || [];
    filas.forEach((fila, fi) => {
      headers.forEach((h, i) => {
        if (fila[h] !== undefined) ws.getRow(5 + fi).getCell(i + 1).value = fila[h];
      });
    });
  }
  await wb.xlsx.writeFile(rutaExcel);
}

/** Escenario base: 4 carreras con estados distintos, 3 historias, 4 bitacoras. */
function datosBase(overrides = {}) {
  const datos = {
    "09_CONFIGURACION": [
      { config_key: "active_master_excel_filename", valor: EXCEL_NOMBRE },
      { config_key: "site_public_base_url", valor: "https://ejemplo.test" },
    ],
    "15_PROVINCIAS": [
      { INDICADOR: "Alcance original", VALOR: 221 },
      { INDICADOR: "Cantones vigentes", VALOR: 222 },
    ],
    "16_TERRITORIO": [
      { territory_id: "c1", provincia: "Azuay", canton_municipio: "Uno" },
      { territory_id: "c2", provincia: "Azuay", canton_municipio: "Dos" },
      { territory_id: "c3", provincia: "Loja", canton_municipio: "Tres" },
      { territory_id: "c4", provincia: "Loja", canton_municipio: "Cuatro" },
      { territory_id: "c5", provincia: "Manabi", canton_municipio: "Cinco" },
    ],
    "02_JORNADAS": [
      { jornada_id: "j1", race_id: "r1", route_id: "rt1" },
      { jornada_id: "j2", race_id: "r2", route_id: "rt2" },
      { jornada_id: "j3", race_id: "r3", route_id: "rt3" },
      { jornada_id: "j4", race_id: "r4", route_id: "rt4" },
      { jornada_id: "j5" },
    ],
    "03_CARRERAS": [
      { race_id: "r1", slug: "uno", titulo: "Uno", fecha: "2026-01-01", location_id: "c1", route_id: "rt1", status: "confirmada" },
      { race_id: "r2", slug: "dos", titulo: "Dos", fecha: "2026-01-02", location_id: "c2", route_id: "rt2", status: "draft" },
      { race_id: "r3", slug: "tres", titulo: "Tres", fecha: "2026-01-03", location_id: "c3", route_id: "rt3", status: "publicada" },
      { race_id: "r4", slug: "cuatro", titulo: "Cuatro", fecha: "2026-01-04", location_id: "c4", route_id: "rt4", status: "rechazada" },
    ],
    "06_RUTAS": [
      { route_id: "rt1", race_id: "r1", race_required: "Sí", canton_id: "c1", distancia_km: 10, geojson_onedrive_path: "RUMBO/03 TRABAJO COWORK/j1/ruta.geojson", source_route_bitacora_id: "b1r" },
      { route_id: "rt2", race_id: "r2", race_required: "Sí", canton_id: "c2", distancia_km: 20, geojson_onedrive_path: "RUMBO/03 TRABAJO COWORK/j2/ruta.geojson" },
      { route_id: "rt3", race_id: "r3", race_required: "Sí", canton_id: "c3", distancia_km: 5, geojson_onedrive_path: "RUMBO/03 TRABAJO COWORK/j3/ruta.geojson" },
      { route_id: "rt4", race_id: "r4", race_required: "Sí", canton_id: "c4", distancia_km: 40, geojson_onedrive_path: "RUMBO/03 TRABAJO COWORK/j4/ruta.geojson" },
    ],
    "04_HISTORIAS": [
      { story_id: "h1", slug: "h-uno", tipo: "reflexion", titulo: "H Uno", fecha: "2026-01-01", location_id: "c1", resumen: "r", status: "aprobada_fidel", source_material_ids: "m1" },
      { story_id: "h2", slug: "h-dos", tipo: "reflexion", titulo: "H Dos", fecha: "2026-01-02", location_id: "c2", resumen: "r", status: "rechazada", source_material_ids: "m2" },
      { story_id: "h3", slug: "h-tres", tipo: "reflexion", titulo: "H Tres", fecha: "2026-01-05", location_id: "c5", resumen: "r", status: "publicada", source_material_ids: "m5" },
    ],
    "05_MEDIOS": [
      { media_id: "m1", tipo_medio: "fotografia", slug: "m-uno", titulo: "M1", archivo_nombre: "uno.jpg", status: "published", bitacora_id: "b1", licencia: "licencia_abierta", derechos_confirmados: "Sí" },
      { media_id: "m2", tipo_medio: "fotografia", slug: "m-dos", titulo: "M2", archivo_nombre: "dos.jpg", status: "published", bitacora_id: "b2", licencia: "licencia_abierta", derechos_confirmados: "Sí" },
      { media_id: "m5", tipo_medio: "fotografia", slug: "m-cinco", titulo: "M5", archivo_nombre: "cinco.jpg", status: "published", bitacora_id: "b5", licencia: "licencia_abierta", derechos_confirmados: "Sí" },
    ],
    "17_BITACORA_ARCHIVOS": [
      { bitacora_id: "b1", jornada_id: "j1", media_id: "m1", nombre_original: "uno.jpg", tipo_archivo: "fotografia", ubicacion_bitacora: "RUMBO/02 BITACORA ORIGINAL/uno.jpg", canton_id: "c1", public_status: "published" },
      { bitacora_id: "b2", jornada_id: "j2", media_id: "m2", nombre_original: "dos.jpg", tipo_archivo: "fotografia", ubicacion_bitacora: "RUMBO/02 BITACORA ORIGINAL/dos.jpg", canton_id: "c2", public_status: "published" },
      { bitacora_id: "b5", jornada_id: "j5", media_id: "m5", nombre_original: "cinco.jpg", tipo_archivo: "fotografia", ubicacion_bitacora: "RUMBO/02 BITACORA ORIGINAL/cinco.jpg", canton_id: "c5", public_status: "published" },
      { bitacora_id: "b9", media_id: "", nombre_original: "huerfano.jpg", tipo_archivo: "fotografia", ubicacion_bitacora: "RUMBO/02 BITACORA ORIGINAL/huerfano.jpg", canton_id: "c1", public_status: "published" },
    ],
    "08_RELACIONES": [],
    "19_ARCHIVOS_DERIVADOS": [],
    "20_METRICAS_ATLETA": [{ tipo_metrica: "vo2max", valor: 52, fecha_hora: "2026-01-01", status: "activo" }],
  };
  for (const [hoja, filas] of Object.entries(overrides)) datos[hoja] = filas;
  return datos;
}

const GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[-79, -2], [-79.01, -2.01]] }, properties: {} }],
});

/** Crea la carpeta operativa ficticia y el codebase ficticio. */
async function montar(datos) {
  const base = tmpdir("root");
  const root = path.join(base, "RUMBO");
  for (const d of ["04_PUBLICACION_WEB", "05_LISTOS_PUBLICAR", "02 BITACORA ORIGINAL", "03 TRABAJO COWORK"]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  for (const j of ["j1", "j2", "j3", "j4"]) {
    fs.mkdirSync(path.join(root, "03 TRABAJO COWORK", j), { recursive: true });
    fs.writeFileSync(path.join(root, "03 TRABAJO COWORK", j, "ruta.geojson"), GEOJSON);
  }
  for (const f of ["uno.jpg", "dos.jpg", "cinco.jpg", "huerfano.jpg"]) {
    fs.writeFileSync(path.join(root, "02 BITACORA ORIGINAL", f), "jpeg-ficticio");
  }
  await escribirExcel(path.join(root, EXCEL_NOMBRE), datos);

  const codebase = path.join(base, "codebase");
  fs.mkdirSync(codebase, { recursive: true });
  return { base, root, codebase };
}

// Devuelve stdout + stderr: los avisos del generador salen por console.warn,
// es decir por stderr, y las pruebas comprueban su texto.
function correr(root, codebase, args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: codebase,
    env: { ...process.env, RUMBO_ONEDRIVE_ROOT: root },
    encoding: "utf-8",
  });
  if (r.status !== 0) {
    throw new Error(`sync-rumbo ${args.join(" ")} salio con codigo ${r.status}: ${r.stderr}`);
  }
  return `${r.stdout}\n${r.stderr}`;
}

const leerJson = (root, nombre) =>
  JSON.parse(fs.readFileSync(path.join(root, "04_PUBLICACION_WEB", nombre), "utf-8"));
const existe = (root, rel) => fs.existsSync(path.join(root, "04_PUBLICACION_WEB", rel));

// ------------------------------------------------------------------ pruebas

await caso("carreras: confirmada y publicada dentro; draft y rechazada fuera", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const ids = leerJson(root, "carreras.json").carreras.map((c) => c.id).sort();
  assert(ids.includes("r1"), "la carrera confirmada deberia estar incluida");
  assert(ids.includes("r3"), "la carrera publicada deberia estar incluida");
  assert(!ids.includes("r2"), "la carrera draft NO deberia estar incluida");
  assert(!ids.includes("r4"), "la carrera rechazada NO deberia estar incluida");
  assert(ids.length === 2, `esperaba 2 carreras, hay ${ids.length}`);
});

await caso("kilometros: solo suman los de carreras publicables", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const resumen = leerJson(root, "resumen.json");
  assert(resumen.kilometros === 15, `esperaba 15 km (10+5), obtuve ${resumen.kilometros}`);
});

await caso("cantones: solo cuentan los de carreras publicables", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const resumen = leerJson(root, "resumen.json");
  assert(resumen.cantonesVisitados === 2, `esperaba 2 cantones, obtuve ${resumen.cantonesVisitados}`);
  const cantones = leerJson(root, "cantones.json").cantones;
  const visitados = cantones.filter((c) => c.visitado).map((c) => c.cantonId).sort();
  assert(JSON.stringify(visitados) === '["c1","c3"]', `cantones visitados: ${JSON.stringify(visitados)}`);
  const geo = leerJson(root, "cantones_visitados.geojson");
  assert(geo.features.length === 2, `el geojson deberia tener 2 features, tiene ${geo.features.length}`);
});

await caso("rutas: solo se copia el geojson de carreras publicables", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  assert(existe(root, "rutas/rt1.geojson"), "deberia existir el geojson de la carrera confirmada");
  assert(existe(root, "rutas/rt3.geojson"), "deberia existir el de la publicada");
  assert(!existe(root, "rutas/rt2.geojson"), "NO deberia existir el de la draft");
  assert(!existe(root, "rutas/rt4.geojson"), "NO deberia existir el de la rechazada");
});

await caso("historias: aprobada y publicada dentro; rechazada fuera", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const ids = leerJson(root, "historias.json").historias.map((h) => h.id).sort();
  assert(ids.includes("h1"), "la historia aprobada_fidel deberia estar incluida");
  assert(ids.includes("h3"), "la historia publicada deberia estar incluida");
  assert(!ids.includes("h2"), "la historia rechazada NO deberia estar incluida");
});

await caso("bitacora: excluye jornadas no publicables y avisa de las huerfanas", async () => {
  const { root, codebase } = await montar(datosBase());
  const salida = correr(root, codebase, ["--generate"]);
  const items = leerJson(root, "bitacora.json").items;
  const ids = items.map((i) => i.id).sort();
  assert(ids.includes("b1"), "b1 (jornada con carrera confirmada) deberia estar");
  assert(ids.includes("b5"), "b5 (jornada con historia publicada) deberia estar");
  assert(!ids.includes("b2"), "b2 (jornada con carrera draft e historia rechazada) NO deberia estar");
  assert(!ids.includes("b9"), "b9 (sin jornada_id) NO deberia estar");
  assert(/b9 excluida: no tiene jornada_id/.test(salida), "deberia avisar por su identificador del elemento sin jornada_id");
  assert(/b2 excluida: su jornada j2 no es publicable/.test(salida), "deberia avisar de la bitacora de jornada no publicable");
});

await caso("una jornada aprobada se conserva completa", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const carreras = leerJson(root, "carreras.json").carreras;
  const r1 = carreras.find((c) => c.id === "r1");
  assert(!!r1, "la carrera de la jornada aprobada debe seguir presente");
  assert(r1 && r1.rutaGeojson === "rutas/rt1.geojson", "debe conservar su geojson");
  const bit = leerJson(root, "bitacora.json").items.filter((i) => i.jornadaId === "j1");
  assert(bit.length === 1, `la bitacora de j1 deberia conservarse (${bit.length})`);
  const medios = leerJson(root, "medios.json").medios.map((m) => m.mediaId);
  assert(medios.includes("m1"), "el medio aprobado de j1 debe conservarse");
  assert(existe(root, "archivos/imagenes/m1.jpg"), "el archivo del medio aprobado debe existir");
});

await caso("manifest: conteos coherentes con el contenido", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const m = leerJson(root, "manifest.json");
  const carreras = leerJson(root, "carreras.json").carreras.length;
  const historias = leerJson(root, "historias.json").historias.length;
  const medios = leerJson(root, "medios.json").medios.length;
  const bit = leerJson(root, "bitacora.json").items.length;
  assert(m.conteos.carreras === carreras && carreras === 2, `manifest.carreras=${m.conteos.carreras}`);
  assert(m.conteos.historias === historias && historias === 2, `manifest.historias=${m.conteos.historias}`);
  assert(m.conteos.medios === medios, "manifest.medios debe coincidir con medios.json");
  assert(m.conteos.bitacoraOriginales === bit && bit === 2, `manifest.bitacora=${m.conteos.bitacoraOriginales}`);
  assert(m.conteos.cantonesVisitados === 2, `manifest.cantonesVisitados=${m.conteos.cantonesVisitados}`);
  assert(m.errores.length === 0, `no deberia haber errores: ${m.errores.join(" | ")}`);
});

await caso("medios: solo los de jornadas publicables entran en el paquete", async () => {
  const { root, codebase } = await montar(datosBase());
  const salida = correr(root, codebase, ["--generate"]);
  const ids = leerJson(root, "medios.json").medios.map((m) => m.mediaId).sort();
  assert(ids.includes("m1"), "m1 (jornada j1 con carrera confirmada) deberia incluirse");
  assert(ids.includes("m5"), "m5 (jornada j5 con historia publicada) deberia incluirse");
  assert(!ids.includes("m2"), "m2 (jornada j2 no publicable) NO deberia incluirse");
  assert(!existe(root, "archivos/imagenes/m2.jpg"), "tampoco deberia copiarse su archivo");
  assert(/Medio m2 excluido: su jornada j2 no es publicable/.test(salida), "deberia avisar del motivo");
});

await caso("medios: sin jornada_id se excluyen con advertencia nominal", async () => {
  const datos = datosBase();
  datos["05_MEDIOS"].push({
    media_id: "m9", tipo_medio: "fotografia", slug: "m-nueve", titulo: "M9",
    archivo_nombre: "huerfano.jpg", status: "published", bitacora_id: "b9",
    licencia: "licencia_abierta", derechos_confirmados: "Sí",
  });
  const { root, codebase } = await montar(datos);
  const salida = correr(root, codebase, ["--generate"]);
  const ids = leerJson(root, "medios.json").medios.map((m) => m.mediaId);
  assert(!ids.includes("m9"), "un medio sin jornada_id NO debe publicarse");
  assert(
    /Medio m9 excluido: no tiene jornada_id/.test(salida),
    "debe avisar por su identificador, no fallar en silencio"
  );
});

await caso("medios: sin derechos se excluye aunque su jornada sea publicable", async () => {
  const datos = datosBase();
  datos["05_MEDIOS"][0].derechos_confirmados = "";
  const { root, codebase } = await montar(datos);
  const salida = correr(root, codebase, ["--generate"]);
  const ids = leerJson(root, "medios.json").medios.map((m) => m.mediaId);
  assert(!ids.includes("m1"), "sin derechos no se publica aunque la jornada sea publicable");
  assert(/Medio m1 publicado pero SIN aprobacion/.test(salida), "deberia mantener el aviso de derechos");
});

await caso("medios: al retirar la jornada desaparecen de medios.json y de archivos/", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  assert(existe(root, "archivos/imagenes/m1.jpg"), "precondicion: el archivo esta");

  const datos = datosBase();
  datos["03_CARRERAS"][0].status = "rechazada";
  datos["04_HISTORIAS"][0].status = "rechazada"; // j1 deja de ser publicable por ambas vias
  await escribirExcel(path.join(root, EXCEL_NOMBRE), datos);
  correr(root, codebase, ["--generate"]);

  const ids = leerJson(root, "medios.json").medios.map((m) => m.mediaId);
  assert(!ids.includes("m1"), "el medio de la jornada retirada no debe seguir en medios.json");
  assert(!existe(root, "archivos/imagenes/m1.jpg"), "ni su archivo en el paquete");
  assert(ids.includes("m5"), "los medios de jornadas que siguen publicables no se tocan");
});

await caso("obsoletos: al dejar de ser publicable, su geojson y su medio se borran", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  assert(existe(root, "rutas/rt1.geojson"), "precondicion: el geojson existe");
  assert(existe(root, "archivos/imagenes/m1.jpg"), "precondicion: el medio existe");

  // La carrera pasa a draft y el medio pierde los derechos: ninguno es ya publicable.
  const datos = datosBase();
  datos["03_CARRERAS"][0].status = "draft";
  datos["05_MEDIOS"][0].derechos_confirmados = "";
  await escribirExcel(path.join(root, EXCEL_NOMBRE), datos);
  const salida = correr(root, codebase, ["--generate"]);

  assert(!existe(root, "rutas/rt1.geojson"), "el geojson obsoleto deberia haberse eliminado");
  assert(!existe(root, "archivos/imagenes/m1.jpg"), "el medio obsoleto deberia haberse eliminado");
  assert(existe(root, "rutas/rt3.geojson"), "el geojson que sigue siendo publicable debe permanecer");
  assert(/Carrera r1 excluida del paquete/.test(salida), "deberia informar de la exclusion");
  assert(!fs.existsSync(path.join(root, "04_PUBLICACION_WEB.nuevo-" + process.pid)), "no debe quedar ningun temporal");
});

await caso("sustitucion: el destino nuevo no hereda residuos, ni con extensiones inesperadas", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const paquete = path.join(root, "04_PUBLICACION_WEB");
  fs.writeFileSync(path.join(paquete, "residuo-viejo.txt"), "de una version anterior");
  fs.mkdirSync(path.join(paquete, "carpeta-vieja"), { recursive: true });
  fs.writeFileSync(path.join(paquete, "carpeta-vieja", "cosa.geojson"), "{}");
  fs.writeFileSync(path.join(paquete, "rutas", "apunte.txt"), "extension inesperada");
  fs.writeFileSync(path.join(root, "02 BITACORA ORIGINAL", "intocable.jpg"), "original");

  correr(root, codebase, ["--generate"]);

  assert(!fs.existsSync(path.join(paquete, "residuo-viejo.txt")), "el residuo debe desaparecer al sustituir el directorio");
  assert(!fs.existsSync(path.join(paquete, "carpeta-vieja")), "una carpeta ajena tampoco sobrevive");
  assert(!fs.existsSync(path.join(paquete, "rutas", "apunte.txt")), "una extension inesperada no debe quedar accesible");
  assert(fs.existsSync(path.join(paquete, "manifest.json")), "el paquete nuevo esta completo");
  assert(
    fs.existsSync(path.join(root, "02 BITACORA ORIGINAL", "intocable.jpg")),
    "fuera de los tres destinos autorizados no se toca nada: los originales siguen ahi"
  );
});

// ------------------------------------------------------- pruebas de fallo
// En todas, el destino anterior debe conservar contenido y hash.

function hashDir(dir) {
  const h = require("node:crypto").createHash("sha256");
  const rec = (d, base) => {
    for (const n of fs.readdirSync(d).sort()) {
      const abs = path.join(d, n);
      const st = fs.lstatSync(abs);
      const rel = path.relative(base, abs).split(path.sep).join("/");
      if (st.isDirectory()) rec(abs, base);
      else h.update(rel).update(fs.readFileSync(abs));
    }
  };
  rec(dir, dir);
  return h.digest("hex");
}

function correrEsperandoFallo(root, codebase, args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: codebase,
    env: { ...process.env, RUMBO_ONEDRIVE_ROOT: root },
    encoding: "utf-8",
  });
  return { code: r.status, salida: `${r.stdout}\n${r.stderr}` };
}

await caso("fallo en la generacion: el paquete anterior no se toca", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  const paquete = path.join(root, "04_PUBLICACION_WEB");
  const antes = hashDir(paquete);

  // race_id duplicado: error de integridad detectado durante la generacion.
  const datos = datosBase();
  datos["03_CARRERAS"].push({ ...datos["03_CARRERAS"][0], slug: "duplicada" });
  await escribirExcel(path.join(root, EXCEL_NOMBRE), datos);
  const { code, salida } = correrEsperandoFallo(root, codebase, ["--generate"]);

  assert(code !== 0, "una generacion con errores debe salir con codigo distinto de 0");
  assert(/race_id duplicado/.test(salida), "debe explicar el error");
  assert(/se conserva intacto/.test(salida), "debe decir que no sustituyo nada");
  assert(hashDir(paquete) === antes, "el paquete anterior debe conservar el mismo hash");
});

await caso("manifest invalido en el paquete: la sincronizacion no toca el destino", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  correr(root, codebase, ["--sync"]);
  const publico = path.join(codebase, "public", "data", "rumbo");
  const antes = hashDir(publico);

  fs.writeFileSync(path.join(root, "04_PUBLICACION_WEB", "manifest.json"), "{ esto no es json");
  const { code, salida } = correrEsperandoFallo(root, codebase, ["--sync"]);

  assert(code !== 0, "debe fallar");
  assert(/JSON invalido en manifest.json/.test(salida), "debe identificar el archivo invalido");
  assert(hashDir(publico) === antes, "public/data/rumbo debe conservar el mismo hash");
});

await caso("fallo durante la copia: falta un archivo del paquete y el destino sigue igual", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  correr(root, codebase, ["--sync"]);
  const publico = path.join(codebase, "public", "data", "rumbo");
  const antes = hashDir(publico);

  fs.unlinkSync(path.join(root, "04_PUBLICACION_WEB", "carreras.json"));
  const { code, salida } = correrEsperandoFallo(root, codebase, ["--sync"]);

  assert(code !== 0, "debe fallar");
  assert(/Falta archivo requerido en el paquete: carreras.json/.test(salida), "debe decir cual falta");
  assert(hashDir(publico) === antes, "el destino debe conservar el mismo hash");
});

await caso("validador: detecta manifest invalido, referencia rota, extension y archivo vacio", async () => {
  const dir = tmpdir("val");
  fs.writeFileSync(path.join(dir, "manifest.json"), "{ roto");
  fs.writeFileSync(path.join(dir, "otro.exe"), "binario");
  fs.writeFileSync(path.join(dir, "vacio.json"), "");
  const problemas = validarDirectorio(dir, {
    obligatorios: ["manifest.json", "resumen.json"],
    extensiones: [".json"],
    comprobaciones: (porRuta) => (porRuta.has("archivos/imagenes/x.jpg") ? [] : ["referencia a un archivo inexistente: archivos/imagenes/x.jpg"]),
  });
  assert(problemas.some((p) => p.includes("falta un archivo obligatorio: resumen.json")), "debe exigir los obligatorios");
  assert(problemas.some((p) => p.includes("extension no permitida: otro.exe")), "debe rechazar extensiones fuera de lista");
  assert(problemas.some((p) => p.includes("archivo vacio: vacio.json")), "debe rechazar archivos vacios");
  assert(problemas.some((p) => p.includes("referencia a un archivo inexistente")), "debe propagar las comprobaciones de referencias");
});

await caso("validador: rechaza enlaces (junction) dentro del temporal", async () => {
  const dir = tmpdir("link");
  const destino = tmpdir("link-destino");
  fs.writeFileSync(path.join(dir, "manifest.json"), "{}");
  let creado = false;
  try {
    fs.symlinkSync(destino, path.join(dir, "enlace"), "junction");
    creado = true;
  } catch {
    console.log("   (omitido: este sistema no permite crear junctions sin privilegios)");
  }
  if (creado) {
    const problemas = validarDirectorio(dir, { obligatorios: [], extensiones: null });
    assert(
      problemas.some((p) => p.includes("enlace simbolico o junction no permitido")),
      `deberia detectar el enlace: ${problemas.join(" | ")}`
    );
  }
});

await caso("sustitucion fallida: el destino conserva contenido y hash", async () => {
  const base = tmpdir("sust");
  const destino = path.join(base, "destino");
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, "vigente.json"), '{"ok":true}');
  const antes = hashDir(destino);

  let fallo = null;
  try {
    await sustituir(destino, path.join(base, "temporal-que-no-existe"));
  } catch (e) {
    fallo = e;
  }
  assert(!!fallo, "sustituir con un temporal inexistente debe fallar");
  assert(fs.existsSync(path.join(destino, "vigente.json")), "el destino debe seguir en su sitio");
  assert(hashDir(destino) === antes, "y con el mismo hash");
});

await caso("sustitucion: no acepta destinos demasiado amplios", async () => {
  let fallo = null;
  try {
    await sustituir(path.parse(process.cwd()).root, tmpdir("x"));
  } catch (e) {
    fallo = e;
  }
  assert(!!fallo && /demasiado amplio/.test(fallo.message), "la raiz de disco debe rechazarse");
});

await caso("sync: el espejo y public quedan sin residuos de la corrida anterior", async () => {
  const { root, codebase } = await montar(datosBase());
  correr(root, codebase, ["--generate"]);
  correr(root, codebase, ["--sync"]);

  const publico = path.join(codebase, "public", "data", "rumbo");
  const espejo = path.join(codebase, "src", "data", "generated", "rumbo-web");
  assert(fs.existsSync(path.join(publico, "rutas", "rt1.geojson")), "precondicion: el geojson esta en public");

  // Residuos plantados a mano, como los dejaria una version anterior.
  fs.writeFileSync(path.join(espejo, "viejo.json"), "{}");
  fs.writeFileSync(path.join(espejo, "apunte.txt"), "no me borres");
  fs.writeFileSync(path.join(publico, "sobrante.json"), "{}");

  const datos = datosBase();
  datos["03_CARRERAS"][0].status = "draft";
  await escribirExcel(path.join(root, EXCEL_NOMBRE), datos);
  correr(root, codebase, ["--generate"]);
  correr(root, codebase, ["--sync"]);

  assert(!fs.existsSync(path.join(publico, "rutas", "rt1.geojson")), "el geojson obsoleto no debe seguir en public");
  assert(!fs.existsSync(path.join(publico, "sobrante.json")), "public no debe conservar archivos ajenos al paquete");
  assert(!fs.existsSync(path.join(espejo, "viejo.json")), "el espejo no debe conservar json obsoletos");
  assert(
    !fs.existsSync(path.join(espejo, "apunte.txt")),
    "al sustituir el directorio entero, tampoco sobrevive un residuo con extension inesperada"
  );
  assert(fs.existsSync(path.join(espejo, "manifest.json")), "el espejo debe conservar los json vigentes");
});

await caso("metricas del atleta: no se vacian aunque no haya jornadas publicables", async () => {
  const datos = datosBase();
  for (const c of datos["03_CARRERAS"]) c.status = "rechazada";
  for (const h of datos["04_HISTORIAS"]) h.status = "rechazada";
  const { root, codebase } = await montar(datos);
  correr(root, codebase, ["--generate"]);
  const resumen = leerJson(root, "resumen.json");
  assert(resumen.cantonesVisitados === 0, "sin carreras publicables no hay cantones visitados");
  assert(resumen.kilometros === 0, "sin carreras publicables no hay kilometros");
  assert(
    resumen.vo2max === 52,
    `VO2max es una metrica del atleta y debe conservarse (obtuve ${resumen.vo2max}). Ver comentario en sync-rumbo.mjs.`
  );
});

// ------------------------------------------------------------------ resumen

for (const d of temporales) {
  try {
    fs.rmSync(d, { recursive: true, force: true });
  } catch {
    // Un temporal que no se puede borrar no invalida las pruebas.
  }
}

console.log(`\n${"-".repeat(52)}`);
console.log(`PASS ${PASS}   FAIL ${FAIL}`);
if (FAIL) {
  console.log("\nFallos:");
  for (const f of fallos) console.log("  - " + f);
}
process.exit(FAIL ? 1 : 0);
