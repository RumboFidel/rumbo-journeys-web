// scripts/tests/test-cierre-redes.mjs
//
// Pruebas locales del cierre automatico de publicaciones, usando SOLO fixtures
// ficticios en un directorio temporal. No toca el entorno operativo, ni
// 05_LISTOS_PUBLICAR real, ni cuentas de redes, ni Make.
//
// Ejecuta el CLI real (registrar-resultado-redes.mjs) como proceso hijo con
// RUMBO_ONEDRIVE_ROOT apuntando al fixture.

import ExcelJS from "exceljs";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const SCRIPT = path.resolve(new URL(".", import.meta.url).pathname, "../registrar-resultado-redes.mjs");
const HEADERS = [
  "publicacion_id","historia_id","carrera_id","publicar_instagram","publicar_facebook",
  "formato_instagram","formato_facebook","texto_instagram","texto_facebook","media_ids",
  "aprobado_por","fecha_aprobacion","estado","fecha_preparacion","fecha_publicacion",
  "archivos","hashes_sha256","motivos_bloqueo_ultima_validacion","instagram_post_id","facebook_post_id",
  "instagram_url","facebook_url","resultado","error_mensaje","intentos",
  "facebook_estado","instagram_estado","facebook_fecha_intento","instagram_fecha_intento",
  "facebook_fecha_publicacion","instagram_fecha_publicacion","facebook_intentos","instagram_intentos",
  "facebook_error","instagram_error",
];

const ONLY = new Set(process.argv.slice(2));
let PASS = 0, FAIL = 0;
const fails = [];
function assert(cond, msg) {
  if (cond) { PASS++; }
  else { FAIL++; fails.push(msg); console.log("   ✗ " + msg); }
}

function mkFixture(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `rumbo-${name}-`));
  for (const d of ["05_LISTOS_PUBLICAR","06_PUBLICADOS","07_PUBLICADOS_PARCIAL","08_ERRORES","00_HERRAMIENTAS"]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  return root;
}

async function buildExcel(root, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("21_PUBLICACIONES_REDES");
  ws.getCell("A1").value = "Publicaciones";
  HEADERS.forEach((h, i) => (ws.getRow(4).getCell(i + 1).value = h));
  rows.forEach((r, ri) => {
    HEADERS.forEach((h, i) => {
      if (r[h] !== undefined) ws.getRow(5 + ri).getCell(i + 1).value = r[h];
    });
  });
  await wb.xlsx.writeFile(path.join(root, "MASTER_TEST.xlsx"));
}

function L(root) { return path.join(root, "05_LISTOS_PUBLICAR"); }
function writeFileIn(dir, name, content) { fs.writeFileSync(path.join(dir, name), content); }
function marker(root, id, prefix, obj) {
  writeFileIn(L(root), `${prefix}__${id}.json`, JSON.stringify(obj ?? { publicacion_id: id, medios: [{ orden: 1, tipo: "video", nombre_archivo: `pub-${id.replace(/^pub-/,'')}__video-01.mp4` }] }, null, 2));
}
function media(root, id) { writeFileIn(L(root), `pub-${id.replace(/^pub-/,'')}__video-01.mp4`, "MP4FAKE"); }
function resultado(root, id, resultados) {
  writeFileIn(L(root), `RESULTADO_PUBLICACION__${id}.json`, JSON.stringify({ schema_version:"1.0", publicacion_id:id, resultados }, null, 2));
}

function run(root, args) {
  return execFileSync("node", [SCRIPT, ...args], { env: { ...process.env, RUMBO_ONEDRIVE_ROOT: root }, encoding: "utf-8" });
}
async function readRows(root) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(root, "MASTER_TEST.xlsx"));
  const ws = wb.getWorksheet("21_PUBLICACIONES_REDES");
  const col = {}; ws.getRow(4).eachCell((c, n) => (col[String(c.value)] = n));
  const out = {};
  for (let r = 5; r <= ws.rowCount; r++) {
    const id = ws.getRow(r).getCell(col.publicacion_id).value;
    if (!id) continue;
    const o = {};
    for (const [h, n] of Object.entries(col)) o[h] = ws.getRow(r).getCell(n).value;
    out[String(id)] = o;
  }
  return out;
}
const listdir = (d) => (fs.existsSync(d) ? fs.readdirSync(d) : []);

async function scen(name, fn) {
  const num = name.split(" ")[0];
  if (ONLY.size && !ONLY.has(num)) return;
  console.log("\n== " + name + " ==");
  const root = mkFixture(name.replace(/[^a-z0-9]+/gi, "-").slice(0, 20));
  try { await fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

async function main() {
  // 1. Solo Facebook exitoso
  await scen("1 solo FB exito", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t1", publicar_facebook:"Sí", publicar_instagram:"No", estado:"lista_para_publicar" }]);
    marker(root,"pub-t1","EN_PROCESO"); media(root,"pub-t1");
    resultado(root,"pub-t1",[{ red:"facebook", estado:"publicada", post_id:"FB1", url:"http://fb/1", fecha_hora:"2026-08-03T20:00:00-05:00" }]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t1"].estado==="publicada","estado global = publicada");
    assert(rows["pub-t1"].facebook_estado==="publicada","facebook_estado = publicada");
    assert(rows["pub-t1"].facebook_post_id==="FB1","facebook_post_id guardado");
    assert(listdir(path.join(root,"06_PUBLICADOS","pub-t1")).length>0,"archivado en 06_PUBLICADOS");
    assert(listdir(L(root)).filter(f=>f.includes("pub-t1")).length===0,"05 limpio para pub-t1");
  });

  // 2. Solo Instagram exitoso
  await scen("2 solo IG exito", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t2", publicar_facebook:"No", publicar_instagram:"Sí", estado:"lista_para_publicar" }]);
    marker(root,"pub-t2","EN_PROCESO"); media(root,"pub-t2");
    resultado(root,"pub-t2",[{ red:"instagram", estado:"publicada", post_id:"IG2", url:"http://ig/2" }]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t2"].estado==="publicada","estado = publicada");
    assert(rows["pub-t2"].instagram_post_id==="IG2","instagram_post_id guardado");
    assert(listdir(path.join(root,"06_PUBLICADOS","pub-t2")).length>0,"archivado en 06");
  });

  // 3. Ambas exitosas
  await scen("3 ambas exito", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t3", publicar_facebook:"Sí", publicar_instagram:"Sí", estado:"lista_para_publicar" }]);
    marker(root,"pub-t3","EN_PROCESO"); media(root,"pub-t3");
    resultado(root,"pub-t3",[{red:"facebook",estado:"publicada",post_id:"FB3"},{red:"instagram",estado:"publicada",post_id:"IG3"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t3"].estado==="publicada","estado = publicada");
    assert(listdir(path.join(root,"06_PUBLICADOS","pub-t3")).length>0,"archivado en 06");
  });

  // 4. FB exito, IG fallo DEFINITIVO (preset intentos=2) -> publicada_parcial (07)
  await scen("4 FB ok IG error def", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t4", publicar_facebook:"Sí", publicar_instagram:"Sí", instagram_intentos:2, estado:"en_proceso" }]);
    marker(root,"pub-t4","EN_PROCESO"); media(root,"pub-t4");
    resultado(root,"pub-t4",[{red:"facebook",estado:"publicada",post_id:"FB4"},{red:"instagram",estado:"error",mensaje_error:"IG caido"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t4"].estado==="publicada_parcial","estado = publicada_parcial");
    assert(Number(rows["pub-t4"].instagram_intentos)===3,"instagram_intentos = 3");
    assert(listdir(path.join(root,"07_PUBLICADOS_PARCIAL","pub-t4")).length>0,"archivado en 07");
  });

  // 5. IG exito, FB fallo DEFINITIVO
  await scen("5 IG ok FB error def", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t5", publicar_facebook:"Sí", publicar_instagram:"Sí", facebook_intentos:2, estado:"en_proceso" }]);
    marker(root,"pub-t5","EN_PROCESO"); media(root,"pub-t5");
    resultado(root,"pub-t5",[{red:"instagram",estado:"publicada",post_id:"IG5"},{red:"facebook",estado:"error",mensaje_error:"FB caido"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t5"].estado==="publicada_parcial","estado = publicada_parcial");
    assert(listdir(path.join(root,"07_PUBLICADOS_PARCIAL","pub-t5")).length>0,"archivado en 07");
  });

  // 6. Ninguna exitosa (ambas error definitivo)
  await scen("6 ninguna exito", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t6", publicar_facebook:"Sí", publicar_instagram:"Sí", facebook_intentos:2, instagram_intentos:2, estado:"en_proceso" }]);
    marker(root,"pub-t6","EN_PROCESO"); media(root,"pub-t6");
    resultado(root,"pub-t6",[{red:"facebook",estado:"error",mensaje_error:"x"},{red:"instagram",estado:"error",mensaje_error:"y"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t6"].estado==="error","estado = error");
    assert(listdir(path.join(root,"08_ERRORES","pub-t6")).length>0,"archivado en 08");
  });

  // 7. Reintento sin repetir la red exitosa (FB ya con post_id; IG error recuperable)
  await scen("7 reintento no repite exito", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t7", publicar_facebook:"Sí", publicar_instagram:"Sí", facebook_post_id:"FB7", facebook_estado:"publicada", instagram_intentos:0, estado:"en_proceso" }]);
    marker(root,"pub-t7","EN_PROCESO"); media(root,"pub-t7");
    resultado(root,"pub-t7",[{red:"instagram",estado:"error",mensaje_error:"IG temporal"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t7"].estado==="en_proceso","estado = en_proceso (reintento pendiente)");
    assert(String(rows["pub-t7"].facebook_post_id)==="FB7","FB conserva post_id (no se toca)");
    const mk = listdir(L(root)).find(f=>f.startsWith("LISTO_PARA_PUBLICAR__pub-t7"));
    assert(!!mk,"se genero marcador de reintento");
    const obj = mk ? JSON.parse(fs.readFileSync(path.join(L(root),mk),"utf-8")) : {};
    assert(JSON.stringify(obj.omitir_redes||[])===JSON.stringify(["facebook"]),"omitir_redes=[facebook]");
    assert(JSON.stringify(obj.redes_a_publicar||[])===JSON.stringify(["instagram"]),"redes_a_publicar=[instagram]");
  });

  // 8. Maximo 3 intentos: preset 2, error -> 3 definitivo (sin nuevo reintento)
  await scen("8 max 3 intentos", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t8", publicar_facebook:"Sí", publicar_instagram:"No", facebook_intentos:2, estado:"en_proceso" }]);
    marker(root,"pub-t8","EN_PROCESO"); media(root,"pub-t8");
    resultado(root,"pub-t8",[{red:"facebook",estado:"error",mensaje_error:"3er fallo"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(Number(rows["pub-t8"].facebook_intentos)===3,"facebook_intentos = 3");
    assert(rows["pub-t8"].estado==="error","estado = error (definitivo)");
    assert(listdir(L(root)).filter(f=>f.startsWith("LISTO_PARA_PUBLICAR__pub-t8")).length===0,"NO se genero reintento tras 3");
    assert(listdir(path.join(root,"08_ERRORES","pub-t8")).length>0,"archivado en 08");
  });

  // 10/11. EN_PROCESO sin RESULTADO -> indeterminado -> pendiente_seguro + verificacion, sin republicar
  await scen("10 EN_PROCESO sin RESULTADO", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t10", publicar_facebook:"Sí", publicar_instagram:"No", estado:"en_proceso" }]);
    marker(root,"pub-t10","EN_PROCESO"); media(root,"pub-t10");
    // sin RESULTADO
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t10"].estado==="pendiente_seguro","estado = pendiente_seguro");
    const mk = listdir(L(root)).find(f=>f.startsWith("LISTO_PARA_PUBLICAR__pub-t10"));
    assert(!!mk,"se genero marcador de verificacion");
    const obj = mk ? JSON.parse(fs.readFileSync(path.join(L(root),mk),"utf-8")) : {};
    assert(obj.verificar_antes_de_publicar===true,"verificar_antes_de_publicar=true");
    assert(listdir(path.join(root,"06_PUBLICADOS")).length===0 && listdir(path.join(root,"08_ERRORES")).length===0,"no archivado (sigue pendiente)");
  });

  // 11. pendiente_seguro por RESULTADO indeterminado
  await scen("11 indeterminado", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t11", publicar_facebook:"Sí", publicar_instagram:"No", estado:"en_proceso" }]);
    marker(root,"pub-t11","EN_PROCESO"); media(root,"pub-t11");
    resultado(root,"pub-t11",[{red:"facebook",estado:"indeterminado"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-t11"].estado==="pendiente_seguro","estado = pendiente_seguro");
  });

  // 12/13. Idempotencia: repetir reconciliar no duplica ni recuenta
  await scen("12 idempotente", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t12", publicar_facebook:"Sí", publicar_instagram:"No", estado:"lista_para_publicar" }]);
    marker(root,"pub-t12","EN_PROCESO"); media(root,"pub-t12");
    resultado(root,"pub-t12",[{red:"facebook",estado:"publicada",post_id:"FB12"}]);
    run(root,["--reconciliar"]);
    run(root,["--reconciliar"]); // segunda vez
    const rows = await readRows(root);
    assert(rows["pub-t12"].estado==="publicada","estado = publicada tras 2 corridas");
    const carpetas = listdir(path.join(root,"06_PUBLICADOS"));
    assert(carpetas.length===1 && carpetas[0]==="pub-t12","una sola carpeta archivada (sin duplicar)");
    assert(listdir(L(root)).filter(f=>f.includes("pub-t12")).length===0,"05 limpio (sin re-archivar)");
  });

  // 14. Lock: si existe lock fresco, se omite
  await scen("14 lock", async (root) => {
    await buildExcel(root, [{ publicacion_id:"pub-t14", publicar_facebook:"Sí", publicar_instagram:"No", estado:"lista_para_publicar" }]);
    marker(root,"pub-t14","EN_PROCESO"); media(root,"pub-t14");
    resultado(root,"pub-t14",[{red:"facebook",estado:"publicada",post_id:"FB14"}]);
    fs.writeFileSync(path.join(L(root),".registrando.lock"), `${process.pid} ${new Date().toISOString()}\n`);
    const out = run(root,["--reconciliar"]);
    assert(/lock/i.test(out),"se detecto el lock y se omitio la corrida");
    const rows = await readRows(root);
    assert(rows["pub-t14"].estado==="lista_para_publicar","no se proceso por el lock (estado sin cambios)");
  });

  // 18. Una jornada nueva no se bloquea por un pendiente anterior
  await scen("18 pendiente no bloquea nueva", async (root) => {
    await buildExcel(root, [
      { publicacion_id:"pub-prev", publicar_facebook:"Sí", publicar_instagram:"No", estado:"en_proceso" },
      { publicacion_id:"pub-nueva", publicar_facebook:"Sí", publicar_instagram:"No", estado:"lista_para_publicar" },
    ]);
    marker(root,"pub-prev","EN_PROCESO"); media(root,"pub-prev"); // sin RESULTADO -> pendiente_seguro
    marker(root,"pub-nueva","EN_PROCESO"); media(root,"pub-nueva");
    resultado(root,"pub-nueva",[{red:"facebook",estado:"publicada",post_id:"FBN"}]);
    run(root,["--reconciliar"]);
    const rows = await readRows(root);
    assert(rows["pub-prev"].estado==="pendiente_seguro","pendiente anterior -> pendiente_seguro");
    assert(rows["pub-nueva"].estado==="publicada","nueva jornada procesada -> publicada");
    assert(listdir(path.join(root,"06_PUBLICADOS","pub-nueva")).length>0,"nueva archivada en 06");
  });

  console.log(`\n==== RESULTADO: ${PASS} OK, ${FAIL} fallos ====`);
  if (FAIL) { console.log("Fallos:\n - " + fails.join("\n - ")); process.exitCode = 1; }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
