// scripts/publicar-web.mjs — RUTINA 09
//
// Lleva al sitio publico un paquete que las rutinas 07 y 08 YA generaron y
// sincronizaron. Esta rutina nunca genera ni sincroniza: si el paquete no
// existe o no corresponde a esta corrida, se detiene y lo dice.
//
// Modos:
//   --verificar   (por defecto)  comprueba todo y muestra el plan. No escribe
//                                datos, ni Excel, ni el indice de git.
//   --publicar --aprobacion <planHash> [--confirmar-retiro]
//                                recalcula el plan, exige que coincida con el
//                                aprobado, hace commit de las dos rutas
//                                generadas y push.
//   --confirmar                  comprueba el despliegue contra la URL publica
//                                y registra el resultado en el Excel.
//
// Nunca: git add -A, force-push, rebase, amend, reset, ni resolucion
// automatica de conflictos.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { resolverRumboRootCLI } from "./lib/rumbo-root.mjs";
import {
  RUTAS_PUBLICABLES,
  calcularPlanHash,
  componentesDelPlan,
  sha256Archivo,
} from "./lib/plan-publicacion.mjs";

const { root: RUMBO_ROOT } = resolverRumboRootCLI();
const REPO = process.cwd();
const PAQUETE_DIR = path.join(RUMBO_ROOT, "04_PUBLICACION_WEB");
const PUBLIC_DIR = path.join(REPO, "public", "data", "rumbo");
const ESPEJO_DIR = path.join(REPO, "src", "data", "generated", "rumbo-web");
const RAMA = "main";

const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);
const valor = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

// --- Modo de prueba y variables de entorno ---
//
// Hay dos clases de variable, y no pueden tratarse igual:
//
//   Ajustes operativos legitimos (siempre permitidos, dentro de limites):
//     RUMBO_ESPERA_MAX_MS, RUMBO_INTERVALO_MS, RUMBO_TIMEOUT_PETICION_MS
//
//   Sustituciones peligrosas (solo con --modo-prueba explicito):
//     RUMBO_SITE_BASE_URL          sustituye la URL publica del Excel
//     RUMBO_SCRIPTS_VERIFICACION   sustituye las comprobaciones locales
//
// Las segundas pueden desviar una publicacion a otro sitio o saltarse las
// pruebas sin que nadie lo note. En una ejecucion operativa, encontrarlas
// definidas es motivo de aborto, no de aviso: una variable de entorno no debe
// poder cambiar en silencio adonde se publica ni que se comprueba.
const MODO_PRUEBA = tiene("--modo-prueba");

const SUSTITUCIONES_PELIGROSAS = ["RUMBO_SITE_BASE_URL", "RUMBO_SCRIPTS_VERIFICACION"];

// Lista FIJA de comprobaciones locales. En operacion no es configurable.
const SCRIPTS_VERIFICACION = ["test:rutas", "test:cierre", "test:publicables", "typecheck", "build"];

const LIMITES = {
  RUMBO_ESPERA_MAX_MS: { min: 1_000, max: 1_800_000, pordefecto: 5 * 60 * 1000 },
  RUMBO_INTERVALO_MS: { min: 100, max: 60_000, pordefecto: 15 * 1000 },
  RUMBO_TIMEOUT_PETICION_MS: { min: 500, max: 120_000, pordefecto: 15 * 1000 },
};

function numeroEnLimites(nombre) {
  const { min, max, pordefecto } = LIMITES[nombre];
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo === "") return pordefecto;
  const n = Number(crudo);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    fallar(`${nombre}="${crudo}" no es un numero entero de milisegundos.`, PARA_FIDEL.revision);
  }
  if (n < min || n > max) {
    fallar(
      `${nombre}=${n} esta fuera de los limites seguros (${min}-${max} ms). ` +
        `Un valor extremo convertiria la espera en una espera infinita o en ninguna espera.`,
      PARA_FIDEL.revision
    );
  }
  return n;
}

// Mensajes que puede ver Fidel. Ninguno menciona rutas, JSON ni comandos.
const PARA_FIDEL = {
  ok: "La jornada quedó publicada en el sitio.",
  retirado: "El contenido quedó retirado del sitio.",
  nada: "No había nada nuevo que publicar.",
  lento: "La publicación está tardando más de lo normal; te confirmo cuando termine.",
  error: "No pude publicar. Nada cambió en el sitio y el error quedó registrado.",
  revision: "Se requiere tu revisión.",
  pendienteRegistro: "La jornada quedó publicada, pero el registro interno quedó pendiente.",
};

let fallos = 0;
function fallar(msg, mensajeFidel = PARA_FIDEL.error) {
  console.error(`\nERROR: ${msg}`);
  console.error(`\nMensaje para Fidel: "${mensajeFidel}"\n`);
  fallos++;
  process.exit(1);
}
function aviso(msg) {
  console.warn(`ADVERTENCIA: ${msg}`);
}

// Se evalua aqui, ya con fallar() y PARA_FIDEL disponibles.
const definidasPeligrosas = SUSTITUCIONES_PELIGROSAS.filter(
  (v) => process.env[v] !== undefined && process.env[v] !== ""
);
if (definidasPeligrosas.length > 0 && !MODO_PRUEBA) {
  fallar(
    `Estas variables de entorno solo se admiten con --modo-prueba y estan definidas: ` +
      `${definidasPeligrosas.join(", ")}. En una ejecucion operativa la URL publica sale de ` +
      `09_CONFIGURACION -> site_public_base_url y las comprobaciones locales son una lista fija del codigo.`,
    PARA_FIDEL.revision
  );
}
if (MODO_PRUEBA) {
  console.log("MODO DE PRUEBA: se admiten sustituciones de URL y de comprobaciones locales.\n");
}

const ESPERA_MAX_MS = numeroEnLimites("RUMBO_ESPERA_MAX_MS");
const INTERVALO_MS = numeroEnLimites("RUMBO_INTERVALO_MS");
const TIMEOUT_PETICION_MS = numeroEnLimites("RUMBO_TIMEOUT_PETICION_MS");
if (INTERVALO_MS >= ESPERA_MAX_MS) {
  fallar(
    `El intervalo de sondeo (${INTERVALO_MS} ms) debe ser menor que la espera maxima (${ESPERA_MAX_MS} ms).`,
    PARA_FIDEL.revision
  );
}

// ---------------------------------------------------------------- utilidades

function git(...a) {
  return execFileSync("git", a, { cwd: REPO, encoding: "utf-8" }).trim();
}
// Sin trim: en "git status --porcelain" la primera columna puede ser un espacio
// (" M archivo") y recortarlo desplaza la ruta un caracter.
function gitCrudo(...a) {
  return execFileSync("git", a, { cwd: REPO, encoding: "utf-8" });
}
function gitSilencioso(...a) {
  try {
    return { ok: true, salida: git(...a) };
  } catch (e) {
    return { ok: false, salida: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
}
// En Windows npm es un .cmd y Node ya no permite ejecutarlo con execFile sin
// shell; pero pasar `shell: true` con argumentos concatena sin escapar y Node
// lo avisa como riesgo (DEP0190). Se invoca el interprete de forma explicita,
// con argumentos fijos, y el nombre del script se valida contra un patron
// estricto: en operacion sale de la constante SCRIPTS_VERIFICACION, nunca de
// una entrada libre.
const NOMBRE_SCRIPT_VALIDO = /^[a-z][a-z0-9:._-]*$/;

function npmRun(script) {
  if (!NOMBRE_SCRIPT_VALIDO.test(script)) {
    fallar(`Nombre de script no permitido: "${script}".`, PARA_FIDEL.revision);
  }
  const opciones = { cwd: REPO, encoding: "utf-8", stdio: "pipe" };
  if (process.platform === "win32") {
    const cmd = process.env.ComSpec || "cmd.exe";
    // /d sin autorun, /s tratamiento estandar de comillas, /c ejecutar y salir.
    // El cwd va por opciones, no en la linea de comandos: una ruta con espacios
    // no necesita comillas ni las puede romper.
    return execFileSync(cmd, ["/d", "/s", "/c", "npm", "run", script], opciones);
  }
  return execFileSync("npm", ["run", script], opciones);
}

function leerJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function excelActivo() {
  const xlsx = fs
    .readdirSync(RUMBO_ROOT)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"));
  if (xlsx.length !== 1) {
    fallar(`Se esperaba exactamente 1 archivo .xlsx en la raiz de RUMBO, hay ${xlsx.length}.`);
  }
  return path.join(RUMBO_ROOT, xlsx[0]);
}

/**
 * Archivos bajo las dos rutas publicables, con su estado en git.
 *
 * Antes de mirar nada se refresca el indice: al reescribir un archivo con el
 * mismo contenido —el build regenera src/routeTree.gen.ts asi— cambia su mtime
 * y "git status" lo marca como modificado aunque no lo este. Refrescar el
 * indice resuelve la mayoria de esos casos; los que sobrevivan se comprueban
 * uno a uno con "git diff", que es la unica autoridad sobre el contenido.
 *
 * La regla de descarte es estrecha a proposito:
 *   - solo se aplica a archivos RASTREADOS;
 *   - un archivo sin seguimiento nunca se descarta;
 *   - se necesita que "git diff" Y "git diff --cached" confirmen que no hay
 *     diferencia; basta que uno detecte cambio para que cuente;
 *   - cualquier cambio real fuera de las dos rutas generadas sigue bloqueando.
 */
function cambiosEnRutasGeneradas() {
  // Equivalente seguro de "git update-index --refresh": actualiza la
  // informacion de estado sin tocar contenido. Devuelve codigo distinto de 0
  // cuando habia entradas desactualizadas, que es precisamente lo normal aqui.
  gitSilencioso("update-index", "-q", "--refresh");

  const porcelain = gitCrudo("status", "--porcelain", "--untracked-files=all");
  const anadidos = [];
  const modificados = [];
  const eliminados = [];
  const fuera = [];
  const ruidoDescartado = [];

  for (const linea of porcelain.split("\n").map((l) => l.replace(/\r$/, "")).filter(Boolean)) {
    const m = linea.match(/^(..) (.*)$/);
    if (!m) continue;
    const estado = m[1];
    const ruta = m[2].replace(/^"|"$/g, "");
    const esPublicable = RUTAS_PUBLICABLES.some((r) => ruta.startsWith(r));

    if (!esPublicable) {
      const sinSeguimiento = estado.includes("?");
      if (sinSeguimiento) {
        fuera.push(`${estado} ${ruta}`);
        continue;
      }
      const igualEnArbol = gitSilencioso("diff", "--quiet", "--", ruta).ok;
      const igualEnIndice = gitSilencioso("diff", "--cached", "--quiet", "--", ruta).ok;
      if (igualEnArbol && igualEnIndice) {
        ruidoDescartado.push(ruta);
        continue;
      }
      fuera.push(`${estado} ${ruta}`);
      continue;
    }

    if (estado.includes("?")) anadidos.push(ruta);
    else if (estado.includes("D")) eliminados.push(ruta);
    else modificados.push(ruta);
  }
  return { anadidos, modificados, eliminados, fuera, ruidoDescartado };
}

/**
 * URL publica efectiva. La del Excel manda siempre; solo en modo de prueba
 * puede sustituirse, y entonces se dice en voz alta.
 */
function urlPublica(desdeExcel) {
  if (MODO_PRUEBA && process.env.RUMBO_SITE_BASE_URL) {
    const sustituta = process.env.RUMBO_SITE_BASE_URL.replace(/\/+$/, "");
    console.log(`  (modo prueba) URL publica sustituida: ${sustituta}`);
    return sustituta;
  }
  return desdeExcel;
}

function urlBaseDesdeExcel(workbook) {
  const ws = workbook.getWorksheet("09_CONFIGURACION");
  if (!ws) return null;
  for (let r = 5; r <= ws.rowCount; r++) {
    if (String(ws.getRow(r).getCell(1).value ?? "").trim() === "site_public_base_url") {
      const v = String(ws.getRow(r).getCell(2).value ?? "").trim();
      return /^https?:\/\//i.test(v) ? v.replace(/\/+$/, "") : null;
    }
  }
  return null;
}

// ------------------------------------------------------- construccion del plan

async function construirPlan({ conFetch = true } = {}) {
  // 1. Rama
  const rama = git("rev-parse", "--abbrev-ref", "HEAD");
  if (rama !== RAMA) {
    fallar(`Solo se publica desde la rama ${RAMA}; estas en "${rama}".`, PARA_FIDEL.revision);
  }

  // 2. El arbol solo puede tener cambios dentro de las dos rutas generadas.
  //    LIMITACION CONOCIDA: 09 no ejecuta 07/08 y por tanto no puede saber que
  //    el arbol estuviera limpio ANTES de generarlas. Lo que si comprueba es la
  //    evidencia disponible al terminar la corrida: que no haya quedado ningun
  //    cambio fuera de esas rutas. Si lo hay, el build local no representaria
  //    lo que se va a commitear y se aborta.
  const cambios = cambiosEnRutasGeneradas();
  if (cambios.fuera.length > 0) {
    console.error("\nHay cambios fuera de las rutas generadas:");
    for (const f of cambios.fuera) console.error(`  ${f}`);
    fallar(
      "El arbol de trabajo debe estar limpio salvo por los datos generados por 07/08.",
      PARA_FIDEL.revision
    );
  }

  // 3. Paquete, public y espejo deben ser la MISMA generacion.
  for (const [nombre, dir] of [["paquete", PAQUETE_DIR], ["public", PUBLIC_DIR], ["espejo", ESPEJO_DIR]]) {
    if (!fs.existsSync(path.join(dir, "manifest.json"))) {
      fallar(`Falta el manifiesto de ${nombre}. Ejecuta antes las rutinas 07 y 08.`, PARA_FIDEL.revision);
    }
  }
  const manPaquete = leerJson(path.join(PAQUETE_DIR, "manifest.json"));
  const manPublic = leerJson(path.join(PUBLIC_DIR, "manifest.json"));
  const manEspejo = leerJson(path.join(ESPEJO_DIR, "manifest.json"));

  const publicacionWebId = manPublic.publicacionWebId;
  if (!publicacionWebId) {
    fallar(
      "El manifiesto no declara publicacionWebId. Vuelve a ejecutar 07 y 08 con la version actual del generador.",
      PARA_FIDEL.revision
    );
  }
  if (manPaquete.publicacionWebId !== publicacionWebId || manEspejo.publicacionWebId !== publicacionWebId) {
    fallar(
      `El paquete, public/ y el espejo no son la misma generacion ` +
        `(paquete=${manPaquete.publicacionWebId}, public=${publicacionWebId}, espejo=${manEspejo.publicacionWebId}). ` +
        `Ejecuta 07 y 08 de nuevo.`,
      PARA_FIDEL.revision
    );
  }
  if (manPublic.errores && manPublic.errores.length > 0) {
    fallar(`El paquete se genero con ${manPublic.errores.length} error(es); no se publica.`, PARA_FIDEL.revision);
  }

  // 4. Excel usado para generar
  const excelPath = excelActivo();
  const hashExcel = sha256Archivo(excelPath);
  if (manPublic.hashExcel !== hashExcel) {
    aviso(
      `El Excel cambio despues de generar el paquete (manifest=${manPublic.hashExcel.slice(0, 12)}..., ` +
        `actual=${hashExcel.slice(0, 12)}...). Se publica lo generado, no lo que hay ahora en el libro.`
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const urlBase = urlPublica(urlBaseDesdeExcel(workbook));
  if (!urlBase) {
    fallar("09_CONFIGURACION -> site_public_base_url no tiene una URL https valida.", PARA_FIDEL.revision);
  }

  // 5. Estados editoriales: segunda barrera, sobre el paquete ya generado.
  const historias = leerJson(path.join(PUBLIC_DIR, "historias.json")).historias || [];
  const PUBLICABLES = ["aprobada_fidel", "publicada"];
  for (const h of historias) {
    if (!PUBLICABLES.includes(String(h.estadoEditorial))) {
      fallar(
        `La historia ${h.id} llego al paquete con estado "${h.estadoEditorial}", que no es publicable.`,
        PARA_FIDEL.revision
      );
    }
  }

  // 6. Archivos prohibidos y referencias rotas dentro de public/
  const prohibidos = [];
  const referenciasRotas = [];
  const caminar = (dir, base = PUBLIC_DIR) => {
    for (const n of fs.readdirSync(dir)) {
      const abs = path.join(dir, n);
      const rel = path.relative(base, abs).split(path.sep).join("/");
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) { prohibidos.push(`${rel} (enlace)`); continue; }
      if (st.isDirectory()) { caminar(abs, base); continue; }
      if (/(^|\/)originales\//.test(rel)) prohibidos.push(rel);
      if (/\.(fit|gpx|tcx|xlsx)$/i.test(rel)) prohibidos.push(rel);
    }
  };
  caminar(PUBLIC_DIR);
  const existeEnPublic = (rel) => fs.existsSync(path.join(PUBLIC_DIR, rel));
  const medios = leerJson(path.join(PUBLIC_DIR, "medios.json")).medios || [];
  const carreras = leerJson(path.join(PUBLIC_DIR, "carreras.json")).carreras || [];
  for (const m of medios) {
    if (m.rutaWeb && !existeEnPublic(m.rutaWeb)) referenciasRotas.push(m.rutaWeb);
  }
  for (const c of carreras) {
    if (c.rutaGeojson && !existeEnPublic(c.rutaGeojson)) referenciasRotas.push(c.rutaGeojson);
  }
  if (prohibidos.length) {
    console.error("\nArchivos que no pueden publicarse:");
    for (const p of prohibidos) console.error(`  ${p}`);
    fallar("El paquete contiene archivos privados o de actividad.", PARA_FIDEL.revision);
  }
  if (referenciasRotas.length) {
    console.error("\nReferencias a archivos que no existen:");
    for (const p of referenciasRotas) console.error(`  ${p}`);
    fallar("El paquete tiene referencias rotas.", PARA_FIDEL.revision);
  }

  // 7. Estado de git
  if (conFetch) {
    const f = gitSilencioso("fetch", "origin");
    if (!f.ok) aviso(`No se pudo hacer fetch de origin: ${f.salida}`);
  }
  const headInicial = git("rev-parse", "HEAD");
  const originMainInicial = git("rev-parse", `origin/${RAMA}`);

  // 8. Hashes de lo que entra
  const hashesNuevos = {};
  for (const rel of [...cambios.anadidos, ...cambios.modificados]) {
    hashesNuevos[rel] = sha256Archivo(path.join(REPO, rel));
  }

  const plan = {
    headInicial,
    originMainInicial,
    hashExcel: manPublic.hashExcel,
    publicacionWebId,
    manifestSha256: sha256Archivo(path.join(PUBLIC_DIR, "manifest.json")),
    anadidos: cambios.anadidos,
    modificados: cambios.modificados,
    eliminados: cambios.eliminados,
    hashesNuevos,
    conteos: manPublic.conteos,
    retira: cambios.eliminados.length > 0,
    urlBase,
    // No entran en el hash: informativos, para el resumen que ve Fidel.
    _historiasEnPaquete: historias.map((h) => h.id),
    _excelPath: excelPath,
    _conteosPrevios: conteosPublicadosEnHead(),
    _metaCantones: leerJson(path.join(PUBLIC_DIR, "resumen.json")).metaCantones,
    _kmAhora: leerJson(path.join(PUBLIC_DIR, "resumen.json")).kilometros,
    _kmAntes: jsonEnHead("resumen.json")?.kilometros,
  };
  plan.planHash = calcularPlanHash(plan);
  return plan;
}

/** Conteos del manifest tal como esta commiteado en HEAD (para el "antes"). */
function conteosPublicadosEnHead() {
  const r = gitSilencioso("show", `HEAD:public/data/rumbo/manifest.json`);
  if (!r.ok) return null;
  try {
    return JSON.parse(r.salida).conteos;
  } catch {
    return null;
  }
}

/** Lee un JSON del paquete tal como esta commiteado en HEAD. */
function jsonEnHead(rel) {
  const r = gitSilencioso("show", `HEAD:public/data/rumbo/${rel}`);
  if (!r.ok) return null;
  try {
    return JSON.parse(r.salida);
  } catch {
    return null;
  }
}

/**
 * Resumen de la retirada en lenguaje de Fidel, derivado del plan real: compara
 * lo que hay commiteado con lo que entra, y cuenta los archivos que salen por
 * su tipo. No hay nada escrito para una jornada concreta.
 */
function resumenRetirada(plan) {
  const piezas = [];

  const carrerasAntes = (jsonEnHead("carreras.json")?.carreras) || [];
  const carrerasAhora = leerJson(path.join(PUBLIC_DIR, "carreras.json")).carreras || [];
  const idsAhora = new Set(carrerasAhora.map((c) => c.id));
  const carrerasFuera = carrerasAntes.filter((c) => !idsAhora.has(c.id));
  for (const c of carrerasFuera) piezas.push(`la carrera «${c.titulo ?? c.id}»`);

  const historiasAntes = (jsonEnHead("historias.json")?.historias) || [];
  const historiasAhora = leerJson(path.join(PUBLIC_DIR, "historias.json")).historias || [];
  const idsHistoria = new Set(historiasAhora.map((h) => h.id));
  const historiasFuera = historiasAntes.filter((h) => !idsHistoria.has(h.id));
  for (const h of historiasFuera) piezas.push(`la historia «${h.titulo ?? h.id}»`);

  // Los archivos que salen, contados por tipo.
  const cuenta = { fotografias: 0, audios: 0, videos: 0, recorridos: 0 };
  for (const rel of plan.eliminados) {
    // Los derivados para Instagram (<base>__instagram.jpg) son copias
    // recortadas de una fotografia que ya se cuenta: no son una foto mas.
    if (/__instagram\.[a-z]+$/i.test(rel)) continue;
    if (/\/archivos\/imagenes\//.test(rel)) cuenta.fotografias++;
    else if (/\/archivos\/audios\//.test(rel)) cuenta.audios++;
    else if (/\/archivos\/videos\//.test(rel)) cuenta.videos++;
    else if (/\/rutas\/.*\.geojson$/.test(rel)) cuenta.recorridos++;
  }
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  if (cuenta.fotografias) piezas.push(plural(cuenta.fotografias, "fotografía", "fotografías"));
  if (cuenta.audios) piezas.push(plural(cuenta.audios, "audio", "audios"));
  if (cuenta.videos) piezas.push(plural(cuenta.videos, "vídeo", "vídeos"));
  if (cuenta.recorridos) {
    piezas.push(cuenta.recorridos === 1 ? "el recorrido del mapa" : `${cuenta.recorridos} recorridos del mapa`);
  }

  const antes = plan._conteosPrevios || {};
  const ahora = plan.conteos || {};
  const contadores = [];
  if (antes.cantonesVisitados !== ahora.cantonesVisitados) {
    contadores.push(`${ahora.cantonesVisitados} de ${plan._metaCantones ?? "221"} municipios`);
  }
  if (plan._kmAntes !== plan._kmAhora) contadores.push(`${plan._kmAhora} km`);

  if (piezas.length === 0 && contadores.length === 0) return null;

  const lista =
    piezas.length > 1
      ? piezas.slice(0, -1).join(", ") + " y " + piezas[piezas.length - 1]
      : piezas[0] ?? "";

  let texto = `Esto retirará del sitio ${lista}.`;
  if (contadores.length) texto += ` Los contadores pasarán a ${contadores.join(" y ")}.`;
  texto += " Los originales se conservarán. ¿Confirmas que quieres retirarlo?";
  return texto;
}

function mostrarPlan(plan) {
  console.log("\n" + "=".repeat(64));
  console.log("PLAN DE PUBLICACION WEB");
  console.log("=".repeat(64));
  console.log(`  Generacion (publicacionWebId) : ${plan.publicacionWebId}`);
  console.log(`  HEAD actual                   : ${plan.headInicial.slice(0, 8)}`);
  console.log(`  origin/${RAMA}                   : ${plan.originMainInicial.slice(0, 8)}`);
  console.log(`  Excel del paquete             : ${plan.hashExcel.slice(0, 12)}...`);
  console.log(`  URL base                      : ${plan.urlBase}`);

  console.log("\n  Contenido que ENTRA:");
  if (!plan.anadidos.length && !plan.modificados.length) console.log("    (nada)");
  for (const f of plan.anadidos) console.log(`    + ${f}`);
  for (const f of plan.modificados) console.log(`    ~ ${f}`);
  console.log("\n  Contenido que SALE:");
  if (!plan.eliminados.length) console.log("    (nada)");
  for (const f of plan.eliminados) console.log(`    - ${f}`);

  const antes = plan._conteosPrevios;
  console.log("\n  Conteos:");
  const claves = ["carreras", "historias", "medios", "cantonesVisitados", "bitacoraOriginales"];
  for (const k of claves) {
    const a = antes ? antes[k] : "?";
    const b = plan.conteos[k];
    const flecha = String(a) === String(b) ? "=" : "->";
    console.log(`    ${k.padEnd(20)} ${String(a).padStart(4)} ${flecha} ${String(b).padStart(4)}`);
  }

  if (plan.retira) {
    console.log("\n  ATENCION: esta publicacion RETIRA contenido que ya estaba en el sitio.");
    const pregunta = resumenRetirada(plan);
    if (pregunta) {
      console.log("\n  Pregunta para Fidel:");
      console.log(`    "${pregunta}"`);
    }
    console.log("\n  Para ejecutarla hace falta ademas el indicador --confirmar-retiro.");
  }
  console.log("\n  planHash: " + plan.planHash);
  console.log("=".repeat(64));
}

// ------------------------------------------------------------------ verificar

async function modoVerificar() {
  const plan = await construirPlan();

  console.log("\nEjecutando comprobaciones locales...");
  // La lista se puede acortar por variable de entorno para las pruebas con
  // fixtures, donde arrancar npm cinco veces por caso hace la suite inviable.
  // En operacion la lista es la constante SCRIPTS_VERIFICACION y no hay forma
  // de acortarla: la variable de entorno ya se rechazo al arrancar.
  const scripts = MODO_PRUEBA
    ? (process.env.RUMBO_SCRIPTS_VERIFICACION ?? SCRIPTS_VERIFICACION.join(","))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : SCRIPTS_VERIFICACION;
  if (scripts.length === 0) console.log("  (comprobaciones locales omitidas por configuracion)");
  for (const s of scripts) {
    try {
      npmRun(s);
      console.log(`  ok  npm run ${s}`);
    } catch (e) {
      console.error(`${e.stdout ?? ""}\n${e.stderr ?? ""}`);
      fallar(`Fallo "npm run ${s}". No se publica nada.`, PARA_FIDEL.error);
    }
  }

  // Los artefactos del build no pueden ensuciar el arbol.
  const tras = cambiosEnRutasGeneradas();
  if (tras.fuera.length > 0) {
    console.error("\nEl build dejo cambios REALES fuera de las rutas generadas:");
    for (const f of tras.fuera) console.error(`  ${f}`);
    fallar("Revisa que .output, .tanstack y .wrangler esten ignorados.", PARA_FIDEL.revision);
  }
  console.log("  ok  los artefactos del build estan ignorados");
  if (tras.ruidoDescartado.length > 0) {
    console.log(
      `  (${tras.ruidoDescartado.length} archivo(s) reescritos por el build sin cambio de contenido: ` +
        `${tras.ruidoDescartado.join(", ")})`
    );
  }

  if (!plan.anadidos.length && !plan.modificados.length && !plan.eliminados.length) {
    mostrarPlan(plan);
    console.log(`\nMensaje para Fidel: "${PARA_FIDEL.nada}"`);
    console.log("No hay nada que publicar: no se creara ningun commit.\n");
    return;
  }

  mostrarPlan(plan);
  console.log("\nPara publicar exactamente este plan:");
  console.log(`  npm run publicar:web -- --publicar --aprobacion ${plan.planHash}` +
    (plan.retira ? " --confirmar-retiro" : ""));
  console.log("\nNo se modifico ningun dato, ni el Excel, ni el indice de git.\n");
}

// ------------------------------------------------------------------- publicar

async function modoPublicar() {
  const aprobacion = valor("--aprobacion");
  if (!aprobacion) {
    fallar("Falta --aprobacion <planHash>. Ejecuta antes publicar:web:verificar.", PARA_FIDEL.revision);
  }

  const plan = await construirPlan();
  if (plan.planHash !== aprobacion) {
    console.error("\nEl plan cambio desde que se aprobo. Componentes actuales:");
    const comp = componentesDelPlan(plan);
    for (const [k, v] of Object.entries(comp)) console.error(`  ${k.padEnd(20)} ${v}`);
    fallar(
      `La aprobacion ${aprobacion.slice(0, 12)}... no corresponde al plan actual ${plan.planHash.slice(0, 12)}...`,
      PARA_FIDEL.revision
    );
  }

  if (plan.retira && !tiene("--confirmar-retiro")) {
    fallar(
      `Esta publicacion retira ${plan.eliminados.length} archivo(s) del sitio. ` +
        `Requiere ademas --confirmar-retiro.`,
      PARA_FIDEL.revision
    );
  }

  if (!plan.anadidos.length && !plan.modificados.length && !plan.eliminados.length) {
    console.log(`\nMensaje para Fidel: "${PARA_FIDEL.nada}"`);
    console.log("No se creo ningun commit.\n");
    return;
  }

  mostrarPlan(plan);

  // Solo las dos rutas generadas. Nunca "git add -A".
  for (const ruta of RUTAS_PUBLICABLES) {
    const r = gitSilencioso("add", "--", ruta);
    if (!r.ok) fallar(`No se pudo preparar ${ruta}: ${r.salida}`);
  }

  const enIndice = git("diff", "--cached", "--name-only").split("\n").filter(Boolean);
  const intrusos = enIndice.filter((f) => !RUTAS_PUBLICABLES.some((r) => f.startsWith(r)));
  if (intrusos.length) {
    gitSilencioso("reset", "--", ...intrusos);
    fallar(`Se colaron archivos fuera de las rutas generadas: ${intrusos.join(", ")}`);
  }
  if (enIndice.length === 0) {
    fallar("No hay nada preparado para commitear.", PARA_FIDEL.nada);
  }

  const mensaje = [
    `web: publica generacion ${plan.publicacionWebId}`,
    "",
    `Contenido: +${plan.anadidos.length} nuevos, ~${plan.modificados.length} actualizados, -${plan.eliminados.length} retirados.`,
    `Conteos: carreras=${plan.conteos.carreras}, historias=${plan.conteos.historias}, medios=${plan.conteos.medios}, cantones=${plan.conteos.cantonesVisitados}.`,
    "",
    "Generado por las rutinas 07 y 08; esta rutina no genera ni sincroniza.",
    "",
    `publicacion-web-id: ${plan.publicacionWebId}`,
    `plan-hash: ${plan.planHash}`,
    `manifest-sha256: ${plan.manifestSha256}`,
    `manifest-hash-excel: ${plan.hashExcel}`,
  ].join("\n");

  const c = gitSilencioso("commit", "-m", mensaje);
  if (!c.ok) fallar(`No se pudo crear el commit: ${c.salida}`);
  const sha = git("rev-parse", "HEAD");
  console.log(`\nCommit creado: ${sha.slice(0, 8)}`);

  const p = gitSilencioso("push", "origin", RAMA);
  if (!p.ok) {
    console.error(p.salida);
    console.error(`\nEl commit ${sha.slice(0, 8)} quedo creado localmente y el sitio NO cambio.`);
    console.error("No se deshace nada automaticamente: decidir si se reintenta o se revierte.");
    fallar("Fallo el push.", PARA_FIDEL.error);
  }
  console.log("Publicado en origin/" + RAMA);
  console.log(`\nAhora ejecuta:  npm run publicar:web:confirmar`);
}

// ------------------------------------------------------------------ confirmar

// Cierra el pool de conexiones que fetch deja abierto. Sin esto el proceso no
// termina por si solo, y salir a la fuerza con sockets vivos puede provocar un
// cierre anomalo en Windows.
let conexionesCerradas = false;
async function cerrarConexiones() {
  // Idempotente: cerrarlo dos veces hace fallar una asercion de libuv en
  // Windows ("!(handle->flags & UV_HANDLE_CLOSING)") y el proceso muere con un
  // codigo de salida absurdo en vez del que corresponde.
  if (conexionesCerradas) return;
  conexionesCerradas = true;
  try {
    const d = globalThis[Symbol.for("undici.globalDispatcher.1")];
    if (d && typeof d.close === "function") await d.close();
  } catch {
    // Si no se puede cerrar, la salida explicita del final se encarga.
  }
}

async function pedir(url, { sinCache = false } = {}) {
  try {
    const cabeceras = sinCache ? { "cache-control": "no-cache", pragma: "no-cache" } : undefined;
    const r = await fetch(url, {
      redirect: "follow",
      headers: cabeceras,
      signal: AbortSignal.timeout(TIMEOUT_PETICION_MS),
    });
    const texto = r.headers.get("content-type")?.includes("json") ? await r.text() : null;
    // Se consume el cuerpo siempre, para que la conexion pueda liberarse.
    if (texto === null) await r.arrayBuffer().catch(() => {});
    return { estado: r.status, texto, cache: r.headers.get("x-vercel-cache") };
  } catch (e) {
    return { estado: 0, texto: null, error: e.message };
  }
}

async function modoConfirmar() {
  const sha = git("rev-parse", "HEAD");
  const mensaje = git("log", "-1", "--format=%B");
  const leerTrailer = (k) => {
    const m = mensaje.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : null;
  };
  const publicacionWebId = leerTrailer("publicacion-web-id");
  const planHash = leerTrailer("plan-hash");
  const manifestSha = leerTrailer("manifest-sha256");
  const manifestHashExcel = leerTrailer("manifest-hash-excel");
  if (!publicacionWebId) {
    fallar("El commit actual no es una publicacion web (no declara publicacion-web-id).", PARA_FIDEL.revision);
  }

  // 1. origin/main debe contener el commit.
  const f = gitSilencioso("fetch", "origin");
  if (!f.ok) aviso(`No se pudo hacer fetch: ${f.salida}`);
  const contiene = gitSilencioso("merge-base", "--is-ancestor", sha, `origin/${RAMA}`);
  if (!contiene.ok) {
    fallar(`origin/${RAMA} todavia no contiene el commit ${sha.slice(0, 8)}.`, PARA_FIDEL.revision);
  }
  console.log(`origin/${RAMA} contiene ${sha.slice(0, 8)}`);

  // 2. Esperar a que el sitio sirva ESA generacion.
  const excelPath = excelActivo();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const urlBase = urlPublica(urlBaseDesdeExcel(wb));
  if (!urlBase) fallar("No hay site_public_base_url valida para verificar.", PARA_FIDEL.revision);

  const urlManifest = `${urlBase}/data/rumbo/manifest.json`;
  const local = leerJson(path.join(PUBLIC_DIR, "manifest.json"));
  const inicio = Date.now();
  let remoto = null;
  let ultimaCache = null;

  while (Date.now() - inicio < ESPERA_MAX_MS) {
    const r = await pedir(urlManifest);
    ultimaCache = r.cache;
    if (r.estado === 200 && r.texto) {
      try {
        const m = JSON.parse(r.texto);
        // La cache MISS no demuestra nada: lo unico que confirma el despliegue
        // es que el identificador de generacion coincida.
        if (m.publicacionWebId === publicacionWebId) {
          remoto = m;
          break;
        }
        console.log(
          `  esperando... el sitio sirve todavia la generacion ${m.publicacionWebId ?? "(sin id)"}` +
            ` (x-vercel-cache=${r.cache ?? "-"})`
        );
      } catch {
        console.log("  esperando... el manifiesto remoto no es JSON valido todavia");
      }
    } else {
      console.log(`  esperando... HTTP ${r.estado}${r.error ? ` (${r.error})` : ""}`);
    }
    await new Promise((res) => setTimeout(res, INTERVALO_MS));
  }

  if (!remoto) {
    console.error(
      `\nTras ${Math.round(ESPERA_MAX_MS / 60000)} minutos el sitio no sirve la generacion ${publicacionWebId}.`
    );
    console.error(`Ultima cabecera x-vercel-cache: ${ultimaCache ?? "-"} (no es prueba de despliegue).`);
    console.error("El commit esta publicado en origin; el despliegue no pudo confirmarse.");
    console.log(`\nMensaje para Fidel: "${PARA_FIDEL.lento}"`);
    await cerrarConexiones();
    process.exitCode = 2;
    return;
  }

  // 3. Comparaciones de contenido
  const problemas = [];
  if (manifestSha) {
    const shaLocal = sha256Archivo(path.join(PUBLIC_DIR, "manifest.json"));
    if (shaLocal !== manifestSha) problemas.push("el manifest local cambio despues del commit");
  }
  for (const k of Object.keys(local.conteos)) {
    if (JSON.stringify(local.conteos[k]) !== JSON.stringify(remoto.conteos?.[k])) {
      problemas.push(`conteo distinto en ${k}: local=${JSON.stringify(local.conteos[k])} remoto=${JSON.stringify(remoto.conteos?.[k])}`);
    }
  }

  // 4. Referencias publicas: una muestra de cada tipo debe responder 200.
  const medios = leerJson(path.join(PUBLIC_DIR, "medios.json")).medios || [];
  const muestras = [];
  for (const tipo of ["imagenes", "videos", "audios"]) {
    const m = medios.find((x) => x.rutaWeb && x.rutaWeb.includes(`/${tipo}/`));
    if (m) muestras.push(m.rutaWeb);
  }
  for (const rel of muestras) {
    const r = await pedir(`${urlBase}/data/rumbo/${rel}`);
    if (r.estado !== 200) problemas.push(`la referencia publica ${rel} responde ${r.estado}`);
    else console.log(`  ok  ${rel}`);
  }

  // 5. Lo retirado debe dejar de responder.
  //
  // Una respuesta 200 guardada en la cache del CDN antes del despliegue haria
  // parecer vigente un archivo ya retirado. Para no dejarse enganar, cada URL
  // se consulta con una cadena de consulta unica derivada del publicacionWebId
  // —que ninguna cache pudo ver antes de esta publicacion— y con cabeceras
  // no-cache. Un 200 en esas condiciones es un 200 de verdad: no se acepta
  // "puede que sea cache".
  const retirados = git("show", "--diff-filter=D", "--name-only", "--format=", "HEAD")
    .split("\n")
    .filter((l) => l.startsWith("public/data/rumbo/"));
  let retirosSinConfirmar = 0;
  for (const rel of retirados) {
    const publico = rel.replace("public/data/rumbo/", "");
    const url = `${urlBase}/data/rumbo/${publico}?verificacion=${encodeURIComponent(publicacionWebId)}`;
    const r = await pedir(url, { sinCache: true });
    if (r.estado === 404) {
      console.log(`  ok  retirado: ${publico} responde 404`);
    } else if (r.estado === 200) {
      retirosSinConfirmar++;
      problemas.push(
        `el archivo retirado ${publico} sigue respondiendo 200 con verificacion=${publicacionWebId} y no-cache`
      );
    } else {
      console.log(`  ok  retirado: ${publico} responde ${r.estado} (no accesible)`);
    }
  }

  if (problemas.length) {
    for (const p of problemas) console.error(`  ${p}`);
    if (retirosSinConfirmar > 0) {
      console.error(
        `\nEstado: DESPLEGADO PERO RETIRO NO CONFIRMADO. ${retirosSinConfirmar} archivo(s) que debian ` +
          `desaparecer siguen accesibles. No se registra como cierre exitoso y no se toca el Excel.`
      );
    }
    fallar("El despliegue no coincide con lo publicado.", PARA_FIDEL.revision);
  }

  console.log(`\nDespliegue confirmado: el sitio sirve la generacion ${publicacionWebId}.`);

  // 6. Registro en el Excel
  const registro = {
    planHash,
    commitSha: sha,
    publicacionWebId,
    manifestSha256: manifestSha,
    manifestHashExcel,
    url: urlBase,
    fecha: new Date().toISOString(),
    retirada: retirados.length > 0,
  };
  // El mensaje sale del tipo real de esta publicacion: si el commit elimino
  // archivos del sitio, lo ocurrido fue una retirada, y decirle a Fidel que
  // "la jornada quedo publicada" seria enganoso. Se deduce del diff, no de un
  // texto escrito para un caso concreto.
  const mensajeFinal = registro.retirada ? PARA_FIDEL.retirado : PARA_FIDEL.ok;
  const queFue = registro.retirada ? "Retirada" : "Publicacion";

  const resultado = await registrarEnExcel(registro, excelPath, local);
  if (resultado.ok && resultado.yaEstaba) {
    console.log(`\n${queFue} ya confirmada y registrada (fila ${resultado.fila} de 01_HISTORIAL_COWORK).`);
    console.log("No se modifico nada: esta ejecucion no anade una segunda fila ni vuelve a tocar los estados.");
    console.log(`\nMensaje para Fidel: "${mensajeFinal}"`);
    return;
  }
  if (resultado.ok) {
    console.log(`\nMensaje para Fidel: "${mensajeFinal}"`);
    return;
  }
  if (resultado.requiereRevision) {
    console.error(`\nRegistro incompatible: ${resultado.motivo}`);
    console.error(`\nMensaje para Fidel: "${PARA_FIDEL.revision}"`);
    await cerrarConexiones();
    process.exitCode = 4;
    return;
  }
  console.log(`\nRegistro pendiente: ${resultado.motivo}`);
  console.log(`Mensaje para Fidel: "${PARA_FIDEL.pendienteRegistro}"`);
  await cerrarConexiones();
  process.exitCode = 3;
}

// --------------------------------------------------------------- Excel

async function registrarEnExcel(registro, excelPath, manifestLocal) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

  // --- Idempotencia PRIMERO ---
  // Identidad minima: publicacionWebId + commit_sha + planHash. Va antes que la
  // comparacion optimista a proposito: la escritura de la primera confirmacion
  // cambia el hash del libro, asi que comprobar el hash antes haria que una
  // segunda ejecucion se declarara "pendiente de registro" cuando en realidad
  // el registro ya esta hecho.
  const yaRegistrado = buscarRegistroPrevio(wb, registro);
  if (yaRegistrado.estado === "identico") {
    return { ok: true, yaEstaba: true, promovidas: [], carrerasPromovidas: [], fila: yaRegistrado.fila };
  }
  if (yaRegistrado.estado === "incompatible") {
    return {
      ok: false,
      requiereRevision: true,
      motivo:
        `en 01_HISTORIAL_COWORK (fila ${yaRegistrado.fila}) ya hay un registro para la generacion ` +
        `${registro.publicacionWebId} con valores distintos: ${yaRegistrado.diferencias.join("; ")}. ` +
        `No se escribe nada; hace falta revisarlo a mano.`,
    };
  }

  // Comparacion optimista: si el libro cambio desde que se genero el paquete y
  // no fue por un registro nuestro, no se escribe. Se prefiere "publicado,
  // pendiente de registro" antes que arriesgarse a pisar una edicion ajena.
  const hashAhora = sha256Archivo(excelPath);
  if (registro.manifestHashExcel && hashAhora !== registro.manifestHashExcel) {
    return {
      ok: false,
      motivo:
        `el Excel cambio despues de generar el paquete ` +
        `(esperado ${registro.manifestHashExcel.slice(0, 12)}..., actual ${hashAhora.slice(0, 12)}...). ` +
        `No se escribe nada y NO se vuelve a publicar.`,
    };
  }

  // Respaldo antes de la primera escritura.
  const dirResp = path.join(RUMBO_ROOT, "00_HERRAMIENTAS", "RESPALDOS", `${registro.fecha.slice(0, 10)}_09`);
  await fsp.mkdir(dirResp, { recursive: true });
  const respaldo = path.join(dirResp, path.basename(excelPath).replace(/\.xlsx$/i, ".PRE_09.xlsx"));
  await fsp.copyFile(excelPath, respaldo);

  // 1. Promover SOLO las historias presentes en historias.json y que sigan en
  //    aprobada_fidel. Una retirada no promueve nada, porque sus historias no
  //    estan en el paquete.
  const idsEnPaquete = new Set(
    (JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "historias.json"), "utf-8")).historias || []).map(
      (h) => h.id
    )
  );
  const ws4 = wb.getWorksheet("04_HISTORIAS");
  const promovidas = [];
  if (ws4) {
    const col = {};
    ws4.getRow(4).eachCell({ includeEmpty: false }, (c, n) => (col[String(c.value ?? "").trim()] = n));
    for (let r = 5; r <= ws4.rowCount; r++) {
      const id = String(ws4.getRow(r).getCell(col.story_id ?? 1).value ?? "").trim();
      if (!id || !idsEnPaquete.has(id)) continue;
      const estado = String(ws4.getRow(r).getCell(col.status).value ?? "").trim();
      if (estado !== "aprobada_fidel") continue; // rechazadas o ya publicadas: intactas
      ws4.getRow(r).getCell(col.status).value = "publicada";
      promovidas.push(id);
    }
  }

  // 1b. Lo mismo para las Carreras, con el catalogo carrera_status:
  //     confirmada incluida -> publicada; publicada se queda; draft, rechazada
  //     o ausente del paquete no se tocan. Una retirada deja carreras.json
  //     vacio, asi que no promueve nada.
  const idsCarrerasEnPaquete = new Set(
    (JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "carreras.json"), "utf-8")).carreras || []).map(
      (c) => c.id
    )
  );
  const ws3 = wb.getWorksheet("03_CARRERAS");
  const carrerasPromovidas = [];
  if (ws3) {
    const col = {};
    ws3.getRow(4).eachCell({ includeEmpty: false }, (c, n) => (col[String(c.value ?? "").trim()] = n));
    for (let r = 5; r <= ws3.rowCount; r++) {
      const id = String(ws3.getRow(r).getCell(col.race_id ?? 1).value ?? "").trim();
      if (!id || !idsCarrerasEnPaquete.has(id)) continue;
      const estado = String(ws3.getRow(r).getCell(col.status).value ?? "").trim();
      if (estado !== "confirmada") continue; // publicada, draft o rechazada: intactas
      ws3.getRow(r).getCell(col.status).value = "publicada";
      carrerasPromovidas.push(id);
    }
  }

  // 2. Registro del evento en 01_HISTORIAL_COWORK.
  const ws1 = wb.getWorksheet("01_HISTORIAL_COWORK");
  if (ws1) {
    const col = {};
    ws1.getRow(4).eachCell({ includeEmpty: false }, (c, n) => (col[String(c.value ?? "").trim()] = n));
    let fila = 5;
    while (String(ws1.getRow(fila).getCell(1).value ?? "").trim() !== "") fila++;
    const set = (nombre, v) => {
      if (col[nombre]) ws1.getRow(fila).getCell(col[nombre]).value = v;
    };
    set("tipo_contenido", registro.retirada ? "retirada_web" : "publicacion_web");
    set("destino", "sitio");
    set("titulo", registro.retirada ? "Retirada de contenido del sitio" : "Publicacion web");
    set(
      "resumen",
      `commit=${registro.commitSha} | publicacionWebId=${registro.publicacionWebId} | ` +
        `planHash=${registro.planHash} | manifestSha256=${registro.manifestSha256} | ` +
        `manifestHashExcel=${registro.manifestHashExcel} | url=${registro.url}`
    );
    set("evidencia_onedrive", `RUMBO/04_PUBLICACION_WEB (manifest ${registro.publicacionWebId})`);
    set("riesgo", "bajo");
    set("decision_registrada", "Publicado");
    set(
      "resultado",
      `despliegue confirmado; historias promovidas: ${promovidas.length ? promovidas.join(",") : "ninguna"}` +
        `; carreras promovidas: ${carrerasPromovidas.length ? carrerasPromovidas.join(",") : "ninguna"}`
    );
    set("fecha_decision", registro.fecha);
    set("referencia_conversacion", "rutina_09");
    set("id_origen", registro.publicacionWebId);
  }

  // Escritura en dos tiempos: primero un temporal fuera de la raiz de RUMBO
  // (donde solo puede haber un .xlsx), se valida que se pueda reabrir con las
  // mismas hojas y con el registro dentro, y solo entonces sustituye al
  // maestro. Si algo falla, el maestro anterior queda intacto.
  const temporal = path.join(dirResp, `.nuevo-${process.pid}.xlsx`);
  const hojasAntes = wb.worksheets.map((w) => w.name).join("|");
  try {
    await wb.xlsx.writeFile(temporal);
    const comprobacion = new ExcelJS.Workbook();
    await comprobacion.xlsx.readFile(temporal);
    const hojasDespues = comprobacion.worksheets.map((w) => w.name).join("|");
    if (hojasDespues !== hojasAntes) {
      throw new Error(`el libro escrito no conserva las mismas hojas (${hojasDespues})`);
    }
    if (buscarRegistroPrevio(comprobacion, registro).estado !== "identico") {
      throw new Error("el libro escrito no contiene el registro de esta publicacion");
    }
    await fsp.rename(temporal, excelPath);
  } catch (e) {
    await fsp.rm(temporal, { force: true });
    return {
      ok: false,
      motivo: `no se pudo escribir el Excel (${e.message}). El maestro anterior queda intacto; respaldo en ${respaldo}.`,
    };
  }

  console.log(`\nExcel actualizado. Respaldo previo en: ${respaldo}`);
  console.log(`  historias promovidas a "publicada": ${promovidas.length ? promovidas.join(", ") : "ninguna"}`);
  console.log(`  carreras promovidas a "publicada" : ${carrerasPromovidas.length ? carrerasPromovidas.join(", ") : "ninguna"}`);
  console.log(`  evento registrado en 01_HISTORIAL_COWORK`);
  return { ok: true, promovidas, carrerasPromovidas };
}

/**
 * Busca en 01_HISTORIAL_COWORK un registro de esta misma publicacion.
 * Devuelve { estado: "ninguno" | "identico" | "incompatible", fila, diferencias }.
 */
function buscarRegistroPrevio(wb, registro) {
  const ws = wb.getWorksheet("01_HISTORIAL_COWORK");
  if (!ws) return { estado: "ninguno" };
  const col = {};
  ws.getRow(4).eachCell({ includeEmpty: false }, (c, n) => (col[String(c.value ?? "").trim()] = n));
  if (!col.resumen) return { estado: "ninguno" };

  for (let r = 5; r <= ws.rowCount; r++) {
    const idOrigen = col.id_origen ? String(ws.getRow(r).getCell(col.id_origen).value ?? "").trim() : "";
    const resumen = String(ws.getRow(r).getCell(col.resumen).value ?? "");
    if (idOrigen !== registro.publicacionWebId && !resumen.includes(registro.publicacionWebId)) continue;

    const leer = (k) => (resumen.match(new RegExp(`${k}=([^|\\s]+)`)) || [])[1] ?? null;
    const diferencias = [];
    if (leer("commit") !== registro.commitSha) {
      diferencias.push(`commit registrado ${leer("commit")} != ${registro.commitSha}`);
    }
    if (leer("planHash") !== registro.planHash) {
      diferencias.push(`planHash registrado ${leer("planHash")} != ${registro.planHash}`);
    }
    return diferencias.length
      ? { estado: "incompatible", fila: r, diferencias }
      : { estado: "identico", fila: r };
  }
  return { estado: "ninguno" };
}

// ------------------------------------------------------------------- CLI

const modo = tiene("--publicar") ? "publicar" : tiene("--confirmar") ? "confirmar" : "verificar";

try {
  if (modo === "verificar") await modoVerificar();
  else if (modo === "publicar") await modoPublicar();
  else await modoConfirmar();
} catch (e) {
  if (!fallos) {
    console.error(`\nERROR inesperado: ${e.stack || e.message}`);
    console.error(`\nMensaje para Fidel: "${PARA_FIDEL.error}"`);
    process.exit(1);
  }
}

// Se deja terminar el proceso por si solo: forzar la salida inmediatamente
// despues de cerrar las conexiones provoca en Windows una asercion de libuv y
// un codigo de salida absurdo. La red de seguridad es un temporizador sin
// referencia: no mantiene vivo el proceso, y solo dispara si a los dos segundos
// algo sigue reteniendo el bucle de eventos.
if (process.exitCode === undefined) process.exitCode = 0;
setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref();
