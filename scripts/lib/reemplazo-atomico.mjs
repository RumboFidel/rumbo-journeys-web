// scripts/lib/reemplazo-atomico.mjs
//
// Sustitucion completa de un directorio generado, sin pasar nunca por un estado
// intermedio en el que el destino este vacio o a medias.
//
// El orden importa: primero se construye todo en un temporal hermano, despues se
// valida ese temporal, y solo si pasa se intercambia con el destino. Si algo
// falla en cualquier punto, el destino anterior sigue exactamente como estaba.
// La secuencia contraria —borrar el destino y luego copiar— deja el sitio roto
// si la copia falla a mitad, y ademas obliga a "limpiar residuos", que es
// justamente lo que un reemplazo completo hace innecesario.
//
// Solo debe usarse con los tres destinos generados del proyecto. Nunca con la
// carpeta operativa, ni con el repositorio, ni con nada que contenga originales.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export class ReemplazoError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReemplazoError";
  }
}

function comprobarDestinoRazonable(destino) {
  if (!destino || String(destino).trim() === "") {
    throw new ReemplazoError("El destino esta vacio o sin resolver.");
  }
  const abs = path.resolve(destino);
  const { root } = path.parse(abs);
  const segmentos = abs.slice(root.length).split(/[\\/]/).filter(Boolean);
  if (abs === root || segmentos.length < 2) {
    throw new ReemplazoError(`Destino demasiado amplio, se aborta: ${abs}`);
  }
  return abs;
}

/** Directorio temporal hermano del destino, en el mismo volumen. */
export function crearTemporal(destino, etiqueta = "tmp") {
  const abs = comprobarDestinoRazonable(destino);
  const tmp = `${abs}.${etiqueta}-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

/** Recorre un arbol devolviendo rutas relativas de archivos, y detecta enlaces. */
function listar(dir, base = dir, acc = []) {
  for (const nombre of fs.readdirSync(dir)) {
    const abs = path.join(dir, nombre);
    const st = fs.lstatSync(abs);
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (st.isSymbolicLink()) {
      acc.push({ rel, tipo: "enlace" });
      continue;
    }
    if (st.isDirectory()) {
      listar(abs, base, acc);
      continue;
    }
    acc.push({ rel, tipo: "archivo", bytes: st.size });
  }
  return acc;
}

/**
 * Valida el contenido de un directorio recien construido antes de publicarlo.
 *
 * @param {string} dir
 * @param {object} reglas
 * @param {string[]} reglas.obligatorios  rutas relativas que deben existir
 * @param {string[]} reglas.extensiones   extensiones permitidas en todo el arbol
 * @param {(contenido:Map<string,object>)=>string[]} reglas.comprobaciones
 *        devuelve una lista de problemas adicionales (referencias, conteos...)
 * @returns {string[]} problemas encontrados (vacio = valido)
 */
export function validarDirectorio(dir, reglas = {}) {
  const { obligatorios = [], extensiones = null, comprobaciones = null } = reglas;
  const problemas = [];

  if (!fs.existsSync(dir)) return [`no existe el directorio a validar: ${dir}`];

  const entradas = listar(dir);
  const porRuta = new Map(entradas.map((e) => [e.rel, e]));

  for (const e of entradas) {
    if (e.tipo === "enlace") problemas.push(`enlace simbolico o junction no permitido: ${e.rel}`);
  }
  if (extensiones) {
    for (const e of entradas) {
      if (e.tipo !== "archivo") continue;
      const ext = path.extname(e.rel).toLowerCase();
      if (!extensiones.includes(ext)) problemas.push(`extension no permitida: ${e.rel}`);
    }
  }
  for (const req of obligatorios) {
    if (!porRuta.has(req)) problemas.push(`falta un archivo obligatorio: ${req}`);
  }
  for (const e of entradas) {
    if (e.tipo === "archivo" && e.bytes === 0) problemas.push(`archivo vacio: ${e.rel}`);
  }
  if (comprobaciones) {
    for (const p of comprobaciones(porRuta) || []) problemas.push(p);
  }

  return problemas;
}

/**
 * Intercambia `temporal` por `destino`. El destino anterior se aparta primero
 * (no se borra), de modo que si el intercambio falla se puede devolver a su
 * sitio. El apartado solo se elimina cuando el destino nuevo ya esta en su
 * lugar y se ha comprobado.
 *
 * @returns {{sustituido:boolean, respaldo:string|null}}
 */
export async function sustituir(destino, temporal, { onAviso = () => {} } = {}) {
  const abs = comprobarDestinoRazonable(destino);
  if (!fs.existsSync(temporal)) {
    throw new ReemplazoError(`No existe el directorio temporal: ${temporal}`);
  }
  if (fs.existsSync(abs) && fs.lstatSync(abs).isSymbolicLink()) {
    throw new ReemplazoError(`El destino es un enlace simbolico o junction, no se sustituye: ${abs}`);
  }

  const respaldo = `${abs}.anterior-${process.pid}`;
  await fsp.rm(respaldo, { recursive: true, force: true });

  const habia = fs.existsSync(abs);
  if (habia) {
    await fsp.rename(abs, respaldo);
  }

  try {
    await fsp.rename(temporal, abs);
  } catch (e) {
    // No se pudo poner el nuevo: se devuelve el anterior a su sitio.
    if (habia && fs.existsSync(respaldo) && !fs.existsSync(abs)) {
      await fsp.rename(respaldo, abs);
      onAviso(`Fallo la sustitucion de ${abs}; se restauro el contenido anterior.`);
    }
    throw new ReemplazoError(`No se pudo sustituir ${abs}: ${e.message}`);
  }

  if (!fs.existsSync(abs)) {
    if (habia && fs.existsSync(respaldo)) await fsp.rename(respaldo, abs);
    throw new ReemplazoError(`El destino no quedo en su sitio tras la sustitucion: ${abs}`);
  }

  // Solo ahora se retira el anterior.
  if (habia) await fsp.rm(respaldo, { recursive: true, force: true });
  return { sustituido: true, respaldo: null };
}

/** Borra un temporal fallido sin tocar nada mas. */
export async function descartarTemporal(temporal) {
  if (!temporal) return;
  const abs = path.resolve(temporal);
  if (!/\.(tmp|nuevo)-\d+$/.test(abs)) return; // solo temporales creados aqui
  await fsp.rm(abs, { recursive: true, force: true });
}
