// scripts/configurar-rumbo.mjs
//
// Configura, una sola vez por computador, donde vive la carpeta operativa de
// RUMBO. Escribe rumbo.config.json junto al package.json (archivo local, NO
// versionado: contiene una ruta personal).
//
// Uso:
//   npm run configurar:rumbo -- "<ruta de tu carpeta RUMBO>"
//   npm run configurar:rumbo -- "<ruta>" --mydrive="/Contratos/.../RUMBO"
//   npm run configurar:rumbo -- --verificar     (no escribe nada: solo informa)
//
// No toca el Excel, no publica, no despliega y no ejecuta ninguna rutina.

import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_FILENAME,
  ENV_ROOT,
  ENV_MYDRIVE,
  RumboRootError,
  calcularRaizMyDrive,
  excelDeLaRaiz,
  leerConfig,
  raizCodebase,
  resolverMyDriveRoot,
  resolverRumboRoot,
  validarRaiz,
} from "./lib/rumbo-root.mjs";

const args = process.argv.slice(2);
const soloVerificar = args.includes("--verificar");
const mydriveArg = args.find((a) => a.startsWith("--mydrive="));
const rutaArg = args.find((a) => !a.startsWith("--")) ?? null;

const CODEBASE = raizCodebase();
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
  const myDrive = resolverMyDriveRoot(info.root, { config: info.config });
  console.log("Carpeta operativa de RUMBO resuelta correctamente.");
  console.log(`  Ruta   : ${info.root}`);
  console.log(`  Origen : ${info.origen}`);
  console.log(`  Excel  : ${info.excel ?? "(no encontrado)"}`);
  console.log(`  My Drive (para Make): ${myDrive ?? "(no calculable: la ruta no cuelga de OneDrive)"}`);
  if (!myDrive) {
    console.log("");
    console.log("  Aviso: sin esa ruta, las publicaciones de redes quedaran bloqueadas con");
    console.log("  no_se_pudo_calcular_ruta_onedrive_my_drive. Declarala con --mydrive=... o");
    console.log(`  con la variable ${ENV_MYDRIVE}.`);
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

const myDrive = mydriveArg
  ? mydriveArg.slice("--mydrive=".length).trim()
  : calcularRaizMyDrive(rutaAbs);

const previa = leerConfig(CODEBASE);
const config = {
  ...(previa ?? {}),
  rumboRoot: rutaAbs,
};
delete config.__ruta;
if (myDrive) config.myDriveRelativeRoot = myDrive;

fs.writeFileSync(DESTINO, JSON.stringify(config, null, 2) + "\n", "utf-8");

console.log(previa ? `Actualizado ${CONFIG_FILENAME}` : `Creado ${CONFIG_FILENAME}`);
console.log(`  Archivo: ${DESTINO}`);
console.log(`  Ruta    : ${rutaAbs}`);
console.log(`  Excel   : ${excelDeLaRaiz(rutaAbs) ?? "(no encontrado)"}`);
console.log(`  My Drive: ${myDrive ?? "(no calculable)"}`);
console.log("");
console.log(`Este archivo es local y no se versiona. La variable ${ENV_ROOT}, si esta`);
console.log("definida, tiene prioridad sobre el.");
