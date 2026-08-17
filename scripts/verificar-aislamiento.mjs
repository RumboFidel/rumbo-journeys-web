// scripts/verificar-aislamiento.mjs
//
// Comprueba que ejecutar las suites de pruebas NO toca nada real.
//
// Por que es un comando aparte y no una comprobacion dentro de las suites:
// el incidente que originó esto fue precisamente una prueba que conocia la
// ubicacion real de rumbo.config.json. Si ahora las suites volvieran a saber
// donde vive ese archivo —aunque fuera solo para leerlo— se reintroduciria el
// acoplamiento que causo el problema, y la primera vez que alguien copiara ese
// codigo para "solo mirar" volveriamos al punto de partida.
//
// Asi que las suites quedan CONFINADAS a directorios temporales y quien vigila
// es este guardian externo, que las ejecuta y compara huellas antes y despues.
//
//   npm run verificar:aislamiento
//
// No escribe nada, no publica, no toca el Excel ni Make.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { CONFIG_FILENAME, raizCodebase, resolverRumboRoot } from "./lib/rumbo-root.mjs";

const CODEBASE = raizCodebase();
const SUITES = ["test:redes", "test:rutas", "test:publicables", "test:publicar", "test:cierre"];

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/** Huella de un archivo. null si no existe. */
function huellaArchivo(p) {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  return sha(fs.readFileSync(p));
}

/**
 * Huella de un arbol completo: nombre relativo, tamano y hash de cada archivo.
 * Detecta altas, bajas, renombrados y cambios de contenido, no solo ediciones.
 */
function huellaArbol(dir) {
  if (!fs.existsSync(dir)) return null;
  const entradas = [];
  const recorrer = (actual, prefijo) => {
    for (const nombre of fs.readdirSync(actual).sort()) {
      const completo = path.join(actual, nombre);
      const rel = prefijo ? `${prefijo}/${nombre}` : nombre;
      const st = fs.statSync(completo);
      if (st.isDirectory()) recorrer(completo, rel);
      else entradas.push(`${rel}|${st.size}|${sha(fs.readFileSync(completo))}`);
    }
  };
  recorrer(dir, "");
  return { hash: sha(entradas.join("\n")), archivos: entradas.length };
}

function tomarHuellas() {
  let raiz = null;
  try {
    raiz = resolverRumboRoot().root;
  } catch {
    // Sin carpeta operativa configurada solo se vigila el codebase.
  }
  const objetivos = [
    ["configuracion local", "archivo", path.join(CODEBASE, CONFIG_FILENAME)],
    ["Excel maestro", "excel", raiz],
    ["04_PUBLICACION_WEB", "arbol", raiz && path.join(raiz, "04_PUBLICACION_WEB")],
    ["05_LISTOS_PUBLICAR", "arbol", raiz && path.join(raiz, "05_LISTOS_PUBLICAR")],
    ["public/data/rumbo", "arbol", path.join(CODEBASE, "public", "data", "rumbo")],
    ["src/data/generated", "arbol", path.join(CODEBASE, "src", "data", "generated")],
  ];
  const out = [];
  for (const [etiqueta, tipo, destino] of objetivos) {
    if (!destino) {
      out.push({ etiqueta, estado: "no disponible", hash: null, archivos: 0 });
      continue;
    }
    if (tipo === "excel") {
      const xlsx = fs.existsSync(destino)
        ? fs.readdirSync(destino).filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$")).sort()
        : [];
      const partes = xlsx.map((f) => `${f}|${huellaArchivo(path.join(destino, f))}`);
      out.push({ etiqueta, estado: xlsx.length ? "vigilado" : "ausente", hash: partes.length ? sha(partes.join("\n")) : null, archivos: xlsx.length });
      continue;
    }
    if (tipo === "archivo") {
      const h = huellaArchivo(destino);
      out.push({ etiqueta, estado: h ? "vigilado" : "ausente", hash: h, archivos: h ? 1 : 0 });
      continue;
    }
    const h = huellaArbol(destino);
    out.push({ etiqueta, estado: h ? "vigilado" : "ausente", hash: h && h.hash, archivos: h ? h.archivos : 0 });
  }
  return out;
}

function imprimir(titulo, huellas) {
  console.log(`\n${titulo}`);
  for (const h of huellas) {
    const corto = h.hash ? h.hash.slice(0, 16) + "…" : "-";
    console.log(`  ${h.etiqueta.padEnd(22)} ${String(h.archivos).padStart(4)} arch  ${corto}`);
  }
}

const antes = tomarHuellas();
imprimir("Huellas ANTES de ejecutar las suites:", antes);

console.log("\nEjecutando suites confinadas a temporales…");
let fallo = null;
for (const suite of SUITES) {
  process.stdout.write(`  ${suite} … `);
  try {
    execFileSync(process.platform === "win32" ? process.env.ComSpec : "npm",
      process.platform === "win32" ? ["/d", "/s", "/c", "npm", "run", suite] : ["run", suite],
      { cwd: CODEBASE, stdio: "pipe" });
    console.log("ok");
  } catch (e) {
    console.log("FALLO");
    fallo = fallo ?? suite;
  }
}

const despues = tomarHuellas();
imprimir("Huellas DESPUES:", despues);

console.log("\nComparacion:");
let cambios = 0;
for (let i = 0; i < antes.length; i++) {
  const a = antes[i];
  const b = despues[i];
  const igual = a.hash === b.hash && a.archivos === b.archivos;
  if (!igual) cambios++;
  console.log(`  ${igual ? "sin cambios" : "  CAMBIO   "}  ${a.etiqueta}`);
}

console.log("");
if (cambios > 0) {
  console.error(`AISLAMIENTO ROTO: ${cambios} objetivo(s) cambiaron al ejecutar las pruebas.`);
  console.error("Alguna suite esta tocando algo real. No continues hasta arreglarlo.");
  process.exit(1);
}
if (fallo) {
  console.error(`El aislamiento se mantuvo, pero la suite "${fallo}" fallo. Revisa su salida por separado.`);
  process.exit(1);
}
console.log("AISLAMIENTO CORRECTO: las suites no tocaron ninguno de los objetivos vigilados.");
