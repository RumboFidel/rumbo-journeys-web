// scripts/lib/rumbo-root.mjs
//
// Resolucion portable de la raiz operativa de RUMBO (la carpeta que contiene el
// Excel maestro, 04_PUBLICACION_WEB y 05_LISTOS_PUBLICAR). Es el unico lugar del
// codebase donde se decide donde vive esa carpeta.
//
// Cascada de resolucion, en este orden:
//   1. process.env.RUMBO_ONEDRIVE_ROOT
//   2. rumbo.config.json  (junto al package.json; NO se versiona)
//   3. Deteccion segura: buscar hacia arriba, como maximo 3 niveles desde el
//      codebase, una carpeta llamada RUMBO que ademas valide. Solo se acepta si
//      hay exactamente una candidata.
//   4. Error explicito y accionable.
//
// Nunca se usa "C:\RUMBO" ni ningun otro fallback silencioso: una ruta que no
// existe debe producir un mensaje que diga que hacer, no un ENOENT a media
// ejecucion.
//
// Este modulo no abre el Excel: solo comprueba el sistema de archivos. La
// comprobacion de 09_CONFIGURACION -> active_master_excel_filename sigue
// haciendola sync-rumbo.mjs, que ya lee el libro.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG_FILENAME = "rumbo.config.json";
export const ENV_ROOT = "RUMBO_ONEDRIVE_ROOT";
export const ENV_MYDRIVE = "RUMBO_MYDRIVE_RELATIVE_ROOT";

// La raiz DEBE llamarse RUMBO: las rutas del Excel vienen como "RUMBO/01 ENTRADA/..."
// y se resuelven contra la carpeta PADRE de la raiz (ver resolveRumboAsset en
// sync-rumbo.mjs). Si la carpeta se llamara de otra forma, todos los medios y
// GeoJSON dejarian de encontrarse en silencio.
export const NOMBRE_RAIZ = "RUMBO";
export const CARPETAS_REQUERIDAS = ["04_PUBLICACION_WEB", "05_LISTOS_PUBLICAR"];
const MAX_NIVELES_DETECCION = 3;

export class RumboRootError extends Error {
  constructor(message) {
    super(message);
    this.name = "RumboRootError";
  }
}

/** Raiz del codebase (la carpeta que contiene package.json). */
export function raizCodebase() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/**
 * Lee rumbo.config.json si existe. Devuelve null si no existe.
 * Un JSON malformado es un error explicito: es preferible detenerse a seguir
 * como si no hubiera configuracion.
 */
export function leerConfig(desde = raizCodebase()) {
  const ruta = path.join(desde, CONFIG_FILENAME);
  if (!fs.existsSync(ruta)) return null;
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, "utf-8");
  } catch (e) {
    throw new RumboRootError(`No se pudo leer ${ruta}: ${e.message}`);
  }
  try {
    const cfg = JSON.parse(crudo);
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
      throw new Error("el contenido no es un objeto JSON");
    }
    return { ...cfg, __ruta: ruta };
  } catch (e) {
    throw new RumboRootError(
      `${CONFIG_FILENAME} no es valido (${e.message}).\n` +
        `  Archivo: ${ruta}\n` +
        `  Corrigelo a mano o vuelve a generarlo con:\n` +
        `      npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"`
    );
  }
}

/**
 * Comprueba una carpeta candidata. Devuelve la lista de problemas encontrados
 * (vacia = valida). No lanza: quien llama decide como reportarlos.
 */
export function validarRaiz(dir, { exigirExcel = true } = {}) {
  const problemas = [];
  if (!dir || !String(dir).trim()) {
    return ["la ruta esta vacia"];
  }
  const abs = path.resolve(dir);

  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return [`la carpeta no existe: ${abs}`];
  }
  if (!stat.isDirectory()) {
    return [`la ruta existe pero no es una carpeta: ${abs}`];
  }

  const base = path.basename(abs);
  if (base.toUpperCase() !== NOMBRE_RAIZ) {
    problemas.push(
      `la carpeta se llama "${base}" y debe llamarse exactamente "${NOMBRE_RAIZ}" ` +
        `(las rutas del Excel empiezan por "RUMBO/" y se resuelven contra la carpeta padre)`
    );
  }

  let contenido = [];
  try {
    contenido = fs.readdirSync(abs);
  } catch (e) {
    return [`no se pudo leer el contenido de ${abs}: ${e.message}`];
  }

  if (exigirExcel) {
    const xlsx = contenido.filter(
      (f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$")
    );
    if (xlsx.length === 0) {
      problemas.push("no hay ningun archivo .xlsx en la raiz (falta el Excel maestro)");
    } else if (xlsx.length > 1) {
      problemas.push(
        `hay ${xlsx.length} archivos .xlsx en la raiz y debe haber exactamente uno: ${xlsx.join(", ")}`
      );
    }
  }

  for (const carpeta of CARPETAS_REQUERIDAS) {
    if (!fs.existsSync(path.join(abs, carpeta))) {
      problemas.push(`falta la subcarpeta ${carpeta}`);
    }
  }

  return problemas;
}

/** Nombre del unico .xlsx de la raiz, o null. */
export function excelDeLaRaiz(dir) {
  try {
    const xlsx = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"));
    return xlsx.length === 1 ? xlsx[0] : null;
  } catch {
    return null;
  }
}

/**
 * Deteccion segura: sube como maximo MAX_NIVELES_DETECCION desde `desde` y busca
 * en cada nivel una subcarpeta llamada RUMBO que valide. Devuelve todas las
 * candidatas encontradas (sin repetir).
 */
export function detectarRaices(desde = raizCodebase(), { exigirExcel = true } = {}) {
  const encontradas = [];
  let actual = path.resolve(desde);

  for (let nivel = 0; nivel <= MAX_NIVELES_DETECCION; nivel++) {
    const candidatas = [];
    if (path.basename(actual).toUpperCase() === NOMBRE_RAIZ) candidatas.push(actual);
    try {
      for (const hijo of fs.readdirSync(actual)) {
        if (hijo.toUpperCase() === NOMBRE_RAIZ) candidatas.push(path.join(actual, hijo));
      }
    } catch {
      // Carpeta ilegible: se ignora y se sigue subiendo.
    }
    for (const c of candidatas) {
      if (validarRaiz(c, { exigirExcel }).length === 0 && !encontradas.includes(c)) {
        encontradas.push(c);
      }
    }
    const padre = path.dirname(actual);
    if (padre === actual) break;
    actual = padre;
  }

  return encontradas;
}

function bloqueDeAyuda(intentos, problemasPorRuta) {
  const lineas = [];
  lineas.push("No encuentro la carpeta operativa de RUMBO.");
  lineas.push("");
  lineas.push("  Buscado en:");
  for (const i of intentos) lineas.push(`    - ${i}`);
  if (problemasPorRuta.length) {
    lineas.push("");
    lineas.push("  Lo que impide usar la ruta indicada:");
    for (const { ruta, problemas } of problemasPorRuta) {
      lineas.push(`    ${ruta}`);
      for (const p of problemas) lineas.push(`      · ${p}`);
    }
  }
  lineas.push("");
  lineas.push("  Configurala una sola vez:");
  lineas.push('      npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"');
  lineas.push("");
  lineas.push("  Requisitos de esa carpeta:");
  lineas.push(`    · llamarse exactamente ${NOMBRE_RAIZ}`);
  lineas.push("    · contener un unico archivo .xlsx (el Excel maestro)");
  lineas.push(`    · contener las subcarpetas ${CARPETAS_REQUERIDAS.join(" y ")}`);
  return lineas.join("\n");
}

/**
 * Resuelve la raiz operativa. Lanza RumboRootError con un mensaje accionable si
 * no la encuentra o si la ruta indicada no cumple los requisitos.
 *
 * Devuelve { root, origen, excel, config }.
 */
export function resolverRumboRoot({
  env = process.env,
  desde = raizCodebase(),
  exigirExcel = true,
} = {}) {
  const intentos = [];
  const problemasPorRuta = [];

  // 1. Variable de entorno
  const desdeEnv = String(env[ENV_ROOT] ?? "").trim();
  if (desdeEnv) {
    const problemas = validarRaiz(desdeEnv, { exigirExcel });
    if (problemas.length === 0) {
      return {
        root: path.resolve(desdeEnv),
        origen: `variable de entorno ${ENV_ROOT}`,
        excel: excelDeLaRaiz(path.resolve(desdeEnv)),
        config: null,
      };
    }
    // Una variable definida pero invalida es un error, no una via muerta: el
    // usuario cree haberla configurado y merece saber por que no sirve.
    throw new RumboRootError(
      `La variable ${ENV_ROOT} apunta a una carpeta que no sirve como raiz de RUMBO.\n` +
        `  Valor: ${desdeEnv}\n` +
        problemas.map((p) => `    · ${p}`).join("\n") +
        `\n\n  Corrige la variable o configura la ruta con:\n` +
        `      npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"`
    );
  }
  intentos.push(`${ENV_ROOT} (no definida)`);

  // 2. Archivo de configuracion local
  const cfg = leerConfig(desde);
  const desdeCfg = cfg ? String(cfg.rumboRoot ?? "").trim() : "";
  if (desdeCfg) {
    const problemas = validarRaiz(desdeCfg, { exigirExcel });
    if (problemas.length === 0) {
      return {
        root: path.resolve(desdeCfg),
        origen: `${CONFIG_FILENAME}`,
        excel: excelDeLaRaiz(path.resolve(desdeCfg)),
        config: cfg,
      };
    }
    intentos.push(`${CONFIG_FILENAME} (ruta no valida)`);
    problemasPorRuta.push({ ruta: desdeCfg, problemas });
  } else if (cfg) {
    intentos.push(`${CONFIG_FILENAME} (existe pero no declara "rumboRoot")`);
  } else {
    intentos.push(`${CONFIG_FILENAME} (no existe)`);
  }

  // 3. Deteccion segura
  const detectadas = detectarRaices(desde, { exigirExcel });
  if (detectadas.length === 1) {
    return {
      root: detectadas[0],
      origen: "deteccion automatica desde el codebase",
      excel: excelDeLaRaiz(detectadas[0]),
      config: cfg,
    };
  }
  if (detectadas.length > 1) {
    throw new RumboRootError(
      `Hay mas de una carpeta RUMBO valida cerca del codebase y no puedo elegir por ti:\n` +
        detectadas.map((d) => `    · ${d}`).join("\n") +
        `\n\n  Indica cual usar:\n` +
        `      npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"`
    );
  }
  intentos.push(`deteccion automatica desde ${desde} (sin resultados)`);

  // 4. Error accionable
  throw new RumboRootError(bloqueDeAyuda(intentos, problemasPorRuta));
}

/**
 * Ruta relativa a la raiz de My Drive que Make usa en "OneDrive > Download a
 * File". Se calcula tomando todo lo que sigue a la carpeta OneDrive dentro de la
 * ruta local. Devuelve null si la raiz no cuelga de una carpeta OneDrive.
 */
export function calcularRaizMyDrive(rutaAbsolutaRumboRoot) {
  const marcador = "OneDrive";
  const idx = String(rutaAbsolutaRumboRoot ?? "").indexOf(marcador);
  if (idx === -1) return null;
  const relativa = String(rutaAbsolutaRumboRoot)
    .slice(idx + marcador.length)
    .replace(/\\/g, "/");
  return relativa.startsWith("/") ? relativa : `/${relativa}`;
}

/**
 * Resuelve la raiz de My Drive con la misma logica de precedencia:
 * variable de entorno -> rumbo.config.json -> calculo desde la ruta local.
 *
 * Importante para el traspaso: si la carpeta operativa deja de estar en OneDrive
 * (Dropbox, Google Drive), el calculo automatico devuelve null y hay que
 * declarar el valor en la configuracion, o toda publicacion quedara bloqueada
 * con no_se_pudo_calcular_ruta_onedrive_my_drive.
 */
export function resolverMyDriveRoot(root, { env = process.env, config = null } = {}) {
  const desdeEnv = String(env[ENV_MYDRIVE] ?? "").trim();
  if (desdeEnv) return desdeEnv;
  const desdeCfg = config ? String(config.myDriveRelativeRoot ?? "").trim() : "";
  if (desdeCfg) return desdeCfg;
  return calcularRaizMyDrive(root);
}

/**
 * Version para scripts de linea de comandos: imprime el mensaje y termina con
 * codigo 1 en vez de propagar una excepcion con traza.
 */
export function resolverRumboRootCLI(opciones = {}) {
  try {
    return resolverRumboRoot(opciones);
  } catch (e) {
    if (e instanceof RumboRootError) {
      console.error("\n" + e.message + "\n");
      process.exit(1);
    }
    throw e;
  }
}
