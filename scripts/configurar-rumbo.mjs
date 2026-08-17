// scripts/configurar-rumbo.mjs
//
// Configura, una sola vez por computador, donde vive la carpeta operativa de
// RUMBO. Escribe rumbo.config.json junto al package.json (archivo local, NO
// versionado: contiene una ruta personal).
//
// Uso:
//   npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"
//   npm run configurar:rumbo -- --verificar     (no escribe nada: solo informa)
//
// No toca el Excel, no publica, no despliega y no ejecuta ninguna rutina.

import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_FILENAME,
  CLAVES_OBSOLETAS,
  ENV_ROOT,
  escribirConfiguracion,
  limpiarClavesObsoletas,
  RumboRootError,
  excelDeLaRaiz,
  leerConfig,
  raizCodebase,
  resolverRumboRoot,
  validarRaiz,
} from "./lib/rumbo-root.mjs";

const args = process.argv.slice(2);
const soloVerificar = args.includes("--verificar");
const MODO_PRUEBA = args.includes("--modo-prueba");
const rutaArg = args.find((a) => !a.startsWith("--")) ?? null;

// --- Destino de la configuracion ---
//
// En operacion, siempre la raiz real del codebase y nada mas. --codebase= solo
// existe bajo --modo-prueba, y fuera de el es motivo de aborto, no de aviso:
// un destino sustituible en operacion permitiria escribir la configuracion de
// otro sitio sin que nadie lo notara.
//
// Se prefiere esta opcion protegida a una variable de entorno precisamente
// porque una variable persiste entre comandos y se olvida; un argumento hay que
// escribirlo cada vez, junto a la bandera que lo habilita.
const codebaseArg = args.find((a) => a.startsWith("--codebase="));
if (codebaseArg && !MODO_PRUEBA) {
  console.error(
    [
      "",
      "--codebase= solo puede usarse junto con --modo-prueba.",
      "",
      "  En una ejecucion operativa, la configuracion se escribe siempre en la",
      `  raiz del proyecto. Permitir otro destino dejaria ${CONFIG_FILENAME} en un`,
      "  lugar que despues nadie encontraria.",
      "",
      "  No se escribio ningun archivo.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const CODEBASE = codebaseArg ? path.resolve(codebaseArg.slice("--codebase=".length)) : raizCodebase();
if (codebaseArg && !fs.existsSync(CODEBASE)) {
  console.error(`\nLa carpeta indicada en --codebase= no existe. No se escribio nada.\n`);
  process.exit(1);
}
const DESTINO = path.join(CODEBASE, CONFIG_FILENAME);

function verificar() {
  let info;
  try {
    info = resolverRumboRoot();
  } catch (e) {
    if (e instanceof RumboRootError) {
      console.error("\n" + e.message + "\n");
      process.exit(1);
    }
    throw e;
  }
  console.log("Carpeta operativa de RUMBO resuelta correctamente.");
  console.log(`  Ruta   : ${info.root}`);
  console.log(`  Origen : ${info.origen}`);
  console.log(`  Excel  : ${info.excel ?? "(no encontrado)"}`);
  const obsoletas = CLAVES_OBSOLETAS.filter((k) => info.config && info.config[k] !== undefined);
  if (obsoletas.length > 0) {
    console.log("");
    console.log(`  Aviso: ${CONFIG_FILENAME} conserva claves obsoletas: ${obsoletas.join(", ")}.`);
    console.log("  Ya no las lee nadie. Vuelve a ejecutar configurar:rumbo con la ruta para limpiarlas.");
  }
  process.exit(0);
}

if (soloVerificar) verificar();

if (!rutaArg) {
  console.error(
    [
      "",
      "Falta la ruta de la carpeta operativa de RUMBO.",
      "",
      "  Uso:",
      '      npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"',
      "",
      "  Para comprobar la configuracion actual sin escribir nada:",
      "      npm run configurar:rumbo -- --verificar",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const rutaAbs = path.resolve(rutaArg);
const problemas = validarRaiz(rutaAbs);
if (problemas.length > 0) {
  console.error(
    [
      "",
      "Esa carpeta no sirve como raiz operativa de RUMBO:",
      `  ${rutaAbs}`,
      ...problemas.map((p) => `    · ${p}`),
      "",
      "  No se escribio ningun archivo de configuracion.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const previa = leerConfig(CODEBASE);
const config = {
  ...(previa ?? {}),
  rumboRoot: rutaAbs,
};
delete config.__ruta;

const limpiadas = limpiarClavesObsoletas(config, { raiz: rutaAbs });

escribirConfiguracion(CODEBASE, config);

console.log(previa ? `Actualizado ${CONFIG_FILENAME}` : `Creado ${CONFIG_FILENAME}`);
console.log(`  Archivo: ${DESTINO}`);
console.log(`  Ruta    : ${rutaAbs}`);
console.log(`  Excel   : ${excelDeLaRaiz(rutaAbs) ?? "(no encontrado)"}`);
if (limpiadas.length > 0) {
  console.log(`  Limpiadas: ${limpiadas.join(", ")} (obsoletas desde el esquema 1.1)`);
}
console.log("");
console.log(`Este archivo es local y no se versiona. La variable ${ENV_ROOT}, si esta`);
console.log("definida, tiene prioridad sobre el.");
