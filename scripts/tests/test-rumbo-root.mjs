// scripts/tests/test-rumbo-root.mjs
//
// Pruebas de la resolucion portable de la raiz operativa de RUMBO. Usa SOLO
// carpetas ficticias en un directorio temporal: no lee ni escribe la carpeta
// operativa real, no abre el Excel, no publica y no llama a Make.
//
// Ejecutar:  npm run test:rutas
//            npm run test:rutas -- deteccion   (solo las pruebas que coincidan)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CONFIG_FILENAME,
  ENV_ROOT,
  ENV_MYDRIVE,
  RumboRootError,
  calcularRaizMyDrive,
  detectarRaices,
  leerConfig,
  raizCodebase,
  resolverMyDriveRoot,
  resolverRumboRoot,
  validarRaiz,
} from "../lib/rumbo-root.mjs";

const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));
const temporales = [];
let PASS = 0;
let FAIL = 0;
const fallos = [];

function assert(cond, msg) {
  if (cond) PASS++;
  else {
    FAIL++;
    fallos.push(msg);
    console.log("   x " + msg);
  }
}

function caso(nombre, fn) {
  if (ONLY.size && ![...ONLY].some((o) => nombre.includes(o))) return;
  console.log(`\n> ${nombre}`);
  try {
    fn();
  } catch (e) {
    FAIL++;
    fallos.push(`${nombre}: excepcion inesperada ${e.message}`);
    console.log("   x excepcion inesperada: " + e.message);
  }
}

function tmp(prefijo) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `rumbo-rutas-${prefijo}-`));
  temporales.push(d);
  return d;
}

/** Crea una raiz operativa ficticia y valida. */
function raizValida(base, { nombre = "RUMBO", excel = ["MAESTRO_TEST.xlsx"], carpetas = ["04_PUBLICACION_WEB", "05_LISTOS_PUBLICAR"] } = {}) {
  const root = path.join(base, nombre);
  fs.mkdirSync(root, { recursive: true });
  for (const c of carpetas) fs.mkdirSync(path.join(root, c), { recursive: true });
  for (const x of excel) fs.writeFileSync(path.join(root, x), "fixture");
  return root;
}

function escribirConfig(dir, obj) {
  fs.writeFileSync(path.join(dir, CONFIG_FILENAME), typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
  return dir;
}

function capturar(fn) {
  try {
    return { valor: fn(), error: null };
  } catch (e) {
    return { valor: null, error: e };
  }
}

// ---------------------------------------------------------------- RUTA VALIDA

caso("ruta valida por variable de entorno", () => {
  const base = tmp("env");
  const root = raizValida(base);
  const r = resolverRumboRoot({ env: { [ENV_ROOT]: root }, desde: tmp("vacio") });
  assert(r.root === path.resolve(root), `root esperado ${root}, obtenido ${r.root}`);
  assert(r.origen.includes(ENV_ROOT), `origen deberia citar la variable, fue "${r.origen}"`);
  assert(r.excel === "MAESTRO_TEST.xlsx", `excel esperado MAESTRO_TEST.xlsx, obtenido ${r.excel}`);
});

caso("ruta valida por rumbo.config.json", () => {
  const base = tmp("cfg");
  const root = raizValida(base);
  const codebase = escribirConfig(tmp("codebase"), { rumboRoot: root });
  const r = resolverRumboRoot({ env: {}, desde: codebase });
  assert(r.root === path.resolve(root), `root esperado ${root}, obtenido ${r.root}`);
  assert(r.origen.includes(CONFIG_FILENAME), `origen deberia citar el archivo, fue "${r.origen}"`);
});

caso("la variable de entorno tiene prioridad sobre el archivo", () => {
  const rootEnv = raizValida(tmp("prio-env"));
  const rootCfg = raizValida(tmp("prio-cfg"));
  const codebase = escribirConfig(tmp("prio-code"), { rumboRoot: rootCfg });
  const r = resolverRumboRoot({ env: { [ENV_ROOT]: rootEnv }, desde: codebase });
  assert(r.root === path.resolve(rootEnv), "deberia ganar la variable de entorno");
});

caso("deteccion automatica desde el codebase", () => {
  const base = tmp("det");
  const root = raizValida(base);
  const desde = path.join(base, "codebase", "sub");
  fs.mkdirSync(desde, { recursive: true });
  const encontradas = detectarRaices(desde);
  assert(encontradas.length === 1, `esperaba 1 candidata, encontre ${encontradas.length}`);
  const r = resolverRumboRoot({ env: {}, desde });
  assert(r.root === path.resolve(root), "deberia detectar la carpeta RUMBO hermana");
  assert(r.origen.includes("deteccion"), `origen deberia citar la deteccion, fue "${r.origen}"`);
});

// -------------------------------------------------------------- RUTA AUSENTE

caso("ruta ausente: error accionable, sin fallback silencioso", () => {
  const { valor, error } = capturar(() => resolverRumboRoot({ env: {}, desde: tmp("ausente") }));
  assert(valor === null, "no deberia resolver ninguna ruta");
  assert(error instanceof RumboRootError, `esperaba RumboRootError, obtuve ${error && error.name}`);
  const m = error ? error.message : "";
  assert(m.includes("configurar:rumbo"), "el mensaje debe decir como configurarlo");
  assert(m.includes(ENV_ROOT), "el mensaje debe listar la variable consultada");
  assert(m.includes(CONFIG_FILENAME), "el mensaje debe listar el archivo consultado");
  assert(!m.includes("C:\\RUMBO"), "el mensaje no debe proponer C:\\RUMBO");
});

caso("ruta ausente: nunca se usa C:\\RUMBO como fallback", () => {
  const r = capturar(() => resolverRumboRoot({ env: {}, desde: tmp("nofallback") }));
  assert(r.valor === null, "no debe devolver ninguna raiz");
  const enModulo = fs.readFileSync(path.join(raizCodebase(), "scripts", "lib", "rumbo-root.mjs"), "utf-8");
  assert(!/"C:\\\\RUMBO"/.test(enModulo), "el modulo no debe contener la constante C:\\RUMBO");
});

// -------------------------------------------------------------- RUTA INVALIDA

caso("invalida: la carpeta no existe", () => {
  const problemas = validarRaiz(path.join(tmp("noexiste"), "RUMBO"));
  assert(problemas.length === 1 && problemas[0].includes("no existe"), `problemas: ${problemas.join(" | ")}`);
});

caso("invalida: variable definida pero apuntando a una carpeta inexistente", () => {
  const { error } = capturar(() =>
    resolverRumboRoot({ env: { [ENV_ROOT]: path.join(tmp("envmala"), "RUMBO") }, desde: tmp("c") })
  );
  assert(error instanceof RumboRootError, "deberia fallar con RumboRootError");
  assert(error && error.message.includes(ENV_ROOT), "el mensaje debe nombrar la variable mal configurada");
});

caso("invalida: la carpeta no se llama RUMBO", () => {
  const base = tmp("nombre");
  const root = raizValida(base, { nombre: "RUMBO_2026" });
  const problemas = validarRaiz(root);
  assert(
    problemas.some((p) => p.includes("debe llamarse exactamente")),
    `esperaba el problema de nombre, obtuve: ${problemas.join(" | ")}`
  );
});

caso("invalida: sin ningun .xlsx", () => {
  const root = raizValida(tmp("sinxlsx"), { excel: [] });
  const problemas = validarRaiz(root);
  assert(problemas.some((p) => p.includes(".xlsx")), `problemas: ${problemas.join(" | ")}`);
  assert(validarRaiz(root, { exigirExcel: false }).length === 0, "sin exigirExcel deberia ser valida");
});

caso("invalida: dos archivos .xlsx en la raiz", () => {
  const root = raizValida(tmp("dosxlsx"), { excel: ["A.xlsx", "B.xlsx"] });
  const problemas = validarRaiz(root);
  assert(
    problemas.some((p) => p.includes("exactamente uno")),
    `problemas: ${problemas.join(" | ")}`
  );
});

caso("invalida: falta una carpeta operativa", () => {
  const root = raizValida(tmp("sincarpeta"), { carpetas: ["04_PUBLICACION_WEB"] });
  const problemas = validarRaiz(root);
  assert(
    problemas.some((p) => p.includes("05_LISTOS_PUBLICAR")),
    `problemas: ${problemas.join(" | ")}`
  );
});

caso("invalida: los temporales de Excel (~$) no cuentan como maestro", () => {
  const root = raizValida(tmp("temporal"), { excel: ["MAESTRO_TEST.xlsx", "~$MAESTRO_TEST.xlsx"] });
  assert(validarRaiz(root).length === 0, "un ~$ abierto no deberia invalidar la raiz");
});

caso("invalida: rumbo.config.json malformado", () => {
  const codebase = escribirConfig(tmp("cfgmal"), "{ esto no es json");
  const { error } = capturar(() => leerConfig(codebase));
  assert(error instanceof RumboRootError, "un config ilegible debe detener la ejecucion");
  assert(error && error.message.includes("configurar:rumbo"), "el mensaje debe decir como regenerarlo");
});

caso("ambiguedad: dos carpetas RUMBO validas no se resuelven por adivinacion", () => {
  const base = tmp("ambiguo");
  raizValida(base);
  const sub = path.join(base, "sub");
  fs.mkdirSync(sub, { recursive: true });
  raizValida(sub);
  const desde = path.join(sub, "codebase");
  fs.mkdirSync(desde, { recursive: true });
  const { error } = capturar(() => resolverRumboRoot({ env: {}, desde }));
  assert(error instanceof RumboRootError, "deberia negarse a elegir");
  assert(error && error.message.includes("mas de una"), `mensaje: ${error && error.message.slice(0, 60)}`);
});

// ------------------------------------------------------------------- MY DRIVE

caso("my drive: se calcula desde una ruta bajo OneDrive", () => {
  const calc = calcularRaizMyDrive("C:\\Users\\alguien\\OneDrive\\Contratos\\FLAR\\RUMBO");
  assert(calc === "/Contratos/FLAR/RUMBO", `obtenido: ${calc}`);
});

caso("my drive: fuera de OneDrive no se inventa", () => {
  assert(calcularRaizMyDrive("D:\\Dropbox\\RUMBO") === null, "sin OneDrive debe devolver null");
});

caso("my drive: la configuracion y la variable mandan sobre el calculo", () => {
  const root = "C:\\Users\\alguien\\OneDrive\\X\\RUMBO";
  assert(
    resolverMyDriveRoot(root, { env: {}, config: { myDriveRelativeRoot: "/desde/config/RUMBO" } }) ===
      "/desde/config/RUMBO",
    "deberia ganar la configuracion sobre el calculo"
  );
  assert(
    resolverMyDriveRoot(root, { env: { [ENV_MYDRIVE]: "/desde/env/RUMBO" }, config: { myDriveRelativeRoot: "/c" } }) ===
      "/desde/env/RUMBO",
    "deberia ganar la variable sobre la configuracion"
  );
});

// ------------------------------------------- REGLAS PROPIAS DEL REGISTRADOR

// registrar-resultado-redes.mjs no resuelve rutas contra la carpeta padre, asi
// que no le aplica el nombre de la raiz; en cambio necesita las cuatro carpetas
// del ciclo de cierre, no 04_PUBLICACION_WEB.
const REGLAS_REGISTRADOR = {
  exigirNombreRaiz: false,
  carpetasRequeridas: ["05_LISTOS_PUBLICAR", "06_PUBLICADOS", "07_PUBLICADOS_PARCIAL", "08_ERRORES"],
};

function raizDeCierre(base, nombre = "rumbo-fixture") {
  const root = path.join(base, nombre);
  fs.mkdirSync(root, { recursive: true });
  for (const c of REGLAS_REGISTRADOR.carpetasRequeridas) fs.mkdirSync(path.join(root, c), { recursive: true });
  fs.writeFileSync(path.join(root, "MASTER_TEST.xlsx"), "fixture");
  return root;
}

caso("registrador: acepta una raiz de fixture que no se llama RUMBO", () => {
  const root = raizDeCierre(tmp("reg-ok"));
  assert(validarRaiz(root, REGLAS_REGISTRADOR).length === 0, "el fixture del harness deberia ser valido");
  assert(
    validarRaiz(root).some((p) => p.includes("debe llamarse exactamente")),
    "con las reglas estrictas si deberia quejarse del nombre"
  );
  const r = resolverRumboRoot({ env: { [ENV_ROOT]: root }, desde: tmp("reg-c"), ...REGLAS_REGISTRADOR });
  assert(r.root === path.resolve(root), "deberia resolver la raiz del fixture");
});

caso("registrador: rechaza una raiz sin las carpetas del ciclo de cierre", () => {
  const base = tmp("reg-falta");
  const root = path.join(base, "RUMBO");
  fs.mkdirSync(path.join(root, "05_LISTOS_PUBLICAR"), { recursive: true });
  fs.writeFileSync(path.join(root, "MASTER_TEST.xlsx"), "fixture");
  const problemas = validarRaiz(root, REGLAS_REGISTRADOR);
  assert(problemas.some((p) => p.includes("06_PUBLICADOS")), `problemas: ${problemas.join(" | ")}`);
  assert(problemas.some((p) => p.includes("08_ERRORES")), "deberia listar todas las que faltan");
});

caso("registrador: 04_PUBLICACION_WEB no es requisito suyo", () => {
  const root = raizDeCierre(tmp("reg-04"));
  assert(!fs.existsSync(path.join(root, "04_PUBLICACION_WEB")), "el fixture no tiene esa carpeta");
  assert(validarRaiz(root, REGLAS_REGISTRADOR).length === 0, "y aun asi debe ser valida para el registrador");
});

function correrRegistrador(root) {
  try {
    execFileSync(
      process.execPath,
      [path.join(raizCodebase(), "scripts", "registrar-resultado-redes.mjs"), "--reconciliar"],
      { env: { ...process.env, [ENV_ROOT]: root }, encoding: "utf-8", stdio: "pipe" }
    );
    return { code: 0, stderr: "" };
  } catch (e) {
    return { code: e.status, stderr: String(e.stderr ?? "") };
  }
}

caso("registrador cli: carpeta inexistente falla antes de tocar nada", () => {
  const { code, stderr } = correrRegistrador(path.join(tmp("reg-cli"), "NO_EXISTE"));
  assert(code === 1, `esperaba codigo 1, obtuve ${code}`);
  assert(stderr.includes("configurar:rumbo"), "el error debe decir como configurarlo");
  assert(stderr.includes("no existe"), "debe decir que la carpeta no existe");
  assert(!stderr.includes("C:\\RUMBO"), "no debe mencionar el antiguo fallback");
  assert(!stderr.includes("ENOENT"), "no debe filtrarse un ENOENT crudo");
});

caso("registrador cli: carpeta sin las terminales lista lo que falta", () => {
  const base = tmp("reg-cli2");
  const root = path.join(base, "RUMBO");
  fs.mkdirSync(path.join(root, "05_LISTOS_PUBLICAR"), { recursive: true });
  fs.writeFileSync(path.join(root, "MASTER_TEST.xlsx"), "fixture");
  const { code, stderr } = correrRegistrador(root);
  assert(code === 1, `esperaba codigo 1, obtuve ${code}`);
  assert(stderr.includes("06_PUBLICADOS"), "debe nombrar la carpeta terminal que falta");
  assert(stderr.includes("08_ERRORES"), "debe nombrarlas todas");
});

// ------------------------------------------------------------ CLI DE VERDAD

caso("cli: --verificar informa correctamente con una ruta valida", () => {
  const root = raizValida(tmp("cli-ok"));
  const salida = execFileSync(
    process.execPath,
    [path.join(raizCodebase(), "scripts", "configurar-rumbo.mjs"), "--verificar"],
    { env: { ...process.env, [ENV_ROOT]: root }, encoding: "utf-8" }
  );
  assert(salida.includes(root), "deberia imprimir la ruta resuelta");
  assert(salida.includes("resuelta correctamente"), `salida inesperada: ${salida.slice(0, 80)}`);
});

caso("cli: --verificar falla con codigo 1 y mensaje accionable", () => {
  const inexistente = path.join(tmp("cli-mal"), "RUMBO");
  let code = 0;
  let stderr = "";
  try {
    execFileSync(
      process.execPath,
      [path.join(raizCodebase(), "scripts", "configurar-rumbo.mjs"), "--verificar"],
      { env: { ...process.env, [ENV_ROOT]: inexistente }, encoding: "utf-8", stdio: "pipe" }
    );
  } catch (e) {
    code = e.status;
    stderr = String(e.stderr ?? "");
  }
  assert(code === 1, `esperaba codigo de salida 1, obtuve ${code}`);
  assert(stderr.includes("configurar:rumbo"), "el error debe decir como configurarlo");
  assert(!stderr.includes("ENOENT"), "no debe filtrarse un ENOENT crudo");
});

// ------------------------------------------------------------------ RESUMEN

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
