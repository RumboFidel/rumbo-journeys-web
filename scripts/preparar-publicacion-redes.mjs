// scripts/preparar-publicacion-redes.mjs
//
// Prepara (y valida) el paquete plano que Make recoge en RUMBO/05_LISTOS_PUBLICAR
// para publicar en Instagram y Facebook. Nunca publica nada por si mismo: solo
// copia medios ya aprobados, escribe el manifiesto JSON y, unicamente cuando
// todas las reglas de seguridad pasan, crea el archivo
// LISTO_PARA_PUBLICAR__<publicacion_id>.json que Make detecta por nombre.
//
// Modos:
//   node scripts/preparar-publicacion-redes.mjs --validar [--publicacion-id=<id>]
//     -> Solo valida (no copia archivos, no escribe el Excel, no crea el marcador).
//        Sin --publicacion-id, valida todas las filas de 21_PUBLICACIONES_REDES.
//   node scripts/preparar-publicacion-redes.mjs --publicacion-id=<id>
//     -> Prepara de verdad: copia medios, escribe el manifiesto y, solo si no hay
//        ningun motivo de bloqueo, crea el marcador LISTO_PARA_PUBLICAR y
//        actualiza la fila correspondiente en 21_PUBLICACIONES_REDES.
//
// Nunca escribe en el Excel en modo --validar. Nunca hace commit/push/deploy.
// Nunca configura ni llama a Make.

import ExcelJS from "exceljs";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const RUMBO_ROOT =
  process.env.RUMBO_ONEDRIVE_ROOT ||
  "C:\\RUMBO"; // <ruta_operativa_RUMBO> — definir con la variable de entorno RUMBO_ONEDRIVE_ROOT
const LISTOS_DIR = path.join(RUMBO_ROOT, "05_LISTOS_PUBLICAR");
const MARKER_PREFIX = "LISTO_PARA_PUBLICAR";
const SCHEMA_VERSION = "1.0";

// Make usa la accion "OneDrive > Download a File" con un File Path relativo a
// la raiz de My Drive (no a RUMBO_ROOT ni a la carpeta local de Windows). Por
// eso ruta_onedrive del manifiesto debe ser la ruta completa desde esa raiz,
// ej. "/Contratos/2. FLAR/1. Fiel a Fidel/RUMBO/05_LISTOS_PUBLICAR/<archivo>",
// apuntando siempre a la copia plana ya generada en 05_LISTOS_PUBLICAR (la
// unica que Make puede descargar), nunca a la ubicacion original dispersa del
// archivo en 02_BITACORA_ORIGINAL.
function calcularRaizMyDrive(rutaAbsolutaRumboRoot) {
  const marcador = "OneDrive";
  const idx = rutaAbsolutaRumboRoot.indexOf(marcador);
  if (idx === -1) return null;
  const relativa = rutaAbsolutaRumboRoot.slice(idx + marcador.length).replace(/\\/g, "/");
  return relativa.startsWith("/") ? relativa : `/${relativa}`;
}

const MYDRIVE_RUMBO_ROOT =
  process.env.RUMBO_MYDRIVE_RELATIVE_ROOT || calcularRaizMyDrive(RUMBO_ROOT);

// --- Utilidades compartidas con scripts/sync-rumbo.mjs (mismo criterio) ---

function readSheet(workbook, sheetName) {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) throw new Error(`Hoja no encontrada en el Excel: ${sheetName}`);
  const headerRow = ws.getRow(4);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });
  const rows = [];
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const firstCell = row.getCell(1).value;
    if (firstCell === null || firstCell === undefined || String(firstCell).trim() === "") continue;
    const obj = { __row: r };
    for (let c = 1; c < headers.length; c++) {
      if (!headers[c]) continue;
      let value = row.getCell(c).value;
      if (value && typeof value === "object" && "text" in value) value = value.text;
      if (value && typeof value === "object" && value instanceof Date) value = value.toISOString();
      obj[headers[c]] = value === undefined ? null : value;
    }
    rows.push(obj);
  }
  return rows;
}

function resolveRumboAsset(relOrAbs) {
  if (!relOrAbs) return null;
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.join(RUMBO_ROOT, "..", relOrAbs);
}

function sha256OfFile(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function safeMediaName(mediaId, originalName) {
  const ext = path.extname(originalName || "").toLowerCase() || "";
  const safe = String(mediaId).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${safe}${ext}`;
}

const TIPO_A_CARPETA_WEB = { fotografia: "imagenes", video: "videos" };

function esSi(v) {
  return String(v ?? "").trim().toLowerCase() === "sí" || String(v ?? "").trim().toLowerCase() === "si";
}

function splitList(v) {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const MIME_POR_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

// --- Carga de datos del Excel (lectura) ---

async function abrirExcel() {
  const xlsxFiles = fs.readdirSync(RUMBO_ROOT).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (xlsxFiles.length !== 1) {
    throw new Error(
      `Se esperaba exactamente 1 archivo .xlsx en la raiz de RUMBO, se encontraron ${xlsxFiles.length}: ${xlsxFiles.join(", ")}`
    );
  }
  const excelPath = path.join(RUMBO_ROOT, xlsxFiles[0]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  return { workbook, excelPath };
}

function cargarContexto(workbook) {
  const configRows = readSheet(workbook, "09_CONFIGURACION");
  const carrerasRows = readSheet(workbook, "03_CARRERAS");
  const historiasRows = readSheet(workbook, "04_HISTORIAS");
  const mediosRows = readSheet(workbook, "05_MEDIOS");
  const bitacoraRows = readSheet(workbook, "17_BITACORA_ARCHIVOS");
  const publicacionesRows = readSheet(workbook, "21_PUBLICACIONES_REDES");

  const siteUrlRow = configRows.find((r) => r.config_key === "site_public_base_url");
  let publicSiteBaseUrl = null;
  const val = siteUrlRow ? String(siteUrlRow.valor ?? "").trim() : "";
  if (val && val !== "PENDIENTE" && /^https?:\/\//i.test(val)) {
    publicSiteBaseUrl = val.replace(/\/+$/, "");
  }

  const mediosPorId = new Map(mediosRows.map((m) => [m.media_id, m]));
  const bitacoraPorId = new Map(bitacoraRows.map((b) => [b.bitacora_id, b]));

  return {
    carrerasRows,
    historiasRows,
    mediosRows,
    bitacoraRows,
    publicacionesRows,
    mediosPorId,
    bitacoraPorId,
    publicSiteBaseUrl,
  };
}

// --- Validacion pura: nunca copia archivos ni escribe nada ---

// Marca de idempotencia estable por publicacion: Make la adjunta al post (o la
// usa para buscarlo despues) y permite verificar si una red ya publico sin
// depender solo de su memoria interna.
function marcaIdempotenciaDe(publicacionId) {
  return `RUMBO::${publicacionId}`;
}

// Redes ya publicadas segun la hoja 21 (post_id presente). En un reintento se
// arrastran para que Make NO las vuelva a publicar (omitir_redes) y para
// conservar su post_id/url en el manifiesto (redes_completadas).
function redesCompletadasDe(pubRow) {
  const out = [];
  if (pubRow.facebook_post_id) {
    out.push({
      red: "facebook",
      post_id: pubRow.facebook_post_id,
      url: pubRow.facebook_url || null,
      fecha: pubRow.facebook_fecha_publicacion || null,
    });
  }
  if (pubRow.instagram_post_id) {
    out.push({
      red: "instagram",
      post_id: pubRow.instagram_post_id,
      url: pubRow.instagram_url || null,
      fecha: pubRow.instagram_fecha_publicacion || null,
    });
  }
  return out;
}

const ESTADOS_REINTENTO = ["en_proceso", "error", "publicada_parcial", "pendiente_seguro"];

function validarPublicacion(pubRow, ctx) {
  const motivos = [];
  const publicacionId = pubRow.publicacion_id;

  const publicarInstagram = esSi(pubRow.publicar_instagram);
  const publicarFacebook = esSi(pubRow.publicar_facebook);

  // Reintento: hay al menos un post_id previo o la fila esta en un estado
  // recuperable. En ese caso NO se trata la presencia de archivos como
  // duplicado, y se arrastran las redes ya publicadas.
  const redesCompletadas = redesCompletadasDe(pubRow);
  const omitirRedes = redesCompletadas.map((r) => r.red);
  const esReintento =
    redesCompletadas.length > 0 ||
    ESTADOS_REINTENTO.includes(String(pubRow.estado ?? "").trim());
  if (!publicarInstagram && !publicarFacebook) {
    motivos.push("ninguna_red_autorizada");
  }

  if (!pubRow.historia_id && !pubRow.carrera_id) {
    motivos.push("sin_historia_ni_carrera_vinculada");
  }

  let historia = null;
  if (pubRow.historia_id) {
    historia = ctx.historiasRows.find((h) => h.story_id === pubRow.historia_id) || null;
    if (!historia) motivos.push("historia_no_encontrada");
    else if (!["aprobada_fidel", "publicada"].includes(historia.status)) motivos.push("historia_no_aprobada");
  }

  let carrera = null;
  if (pubRow.carrera_id) {
    carrera = ctx.carrerasRows.find((c) => c.race_id === pubRow.carrera_id) || null;
    if (!carrera) motivos.push("carrera_no_encontrada");
    else if (carrera.status !== "confirmada") motivos.push("carrera_no_confirmada");
  }

  if (!pubRow.aprobado_por || !pubRow.fecha_aprobacion) {
    motivos.push("falta_aprobacion_explicita_de_fidel");
  }

  if (publicarInstagram && !String(pubRow.texto_instagram ?? "").trim()) motivos.push("falta_texto_instagram");
  if (publicarFacebook && !String(pubRow.texto_facebook ?? "").trim()) motivos.push("falta_texto_facebook");

  // Duplicados: otra fila con el mismo publicacion_id ya lista/publicada, o
  // archivos ya presentes en la carpeta plana que vigila Make.
  const otraFilaMisma = ctx.publicacionesRows.find(
    (r) => r.publicacion_id === publicacionId && r.__row !== pubRow.__row && ["lista_para_publicar", "publicada"].includes(r.estado)
  );
  if (otraFilaMisma) motivos.push("publicacion_duplicada");
  // En un reintento legitimo los medios planos ya estan en 05_LISTOS_PUBLICAR;
  // no debe contarse como duplicado. Solo se bloquea por archivos preexistentes
  // cuando NO es reintento.
  if (!esReintento && fs.existsSync(LISTOS_DIR)) {
    const yaExiste = fs
      .readdirSync(LISTOS_DIR)
      .some((f) => f.includes(`pub-${sufijoId(publicacionId)}`) || f === `${MARKER_PREFIX}__${publicacionId}.json`);
    if (yaExiste) motivos.push("publicacion_duplicada");
  }

  const mediaIds = splitList(pubRow.media_ids);
  if (mediaIds.length === 0) motivos.push("sin_medios");

  const medios = [];
  let contadorImagen = 0;
  let contadorVideo = 0;
  for (const mediaId of mediaIds) {
    const medio = ctx.mediosPorId.get(mediaId);
    if (!medio) {
      motivos.push(`media_id_no_encontrado_en_05_medios:${mediaId}`);
      continue;
    }
    if (medio.status !== "published") {
      motivos.push(`medio_no_publicado:${mediaId}`);
    }
    const tipoWeb = TIPO_A_CARPETA_WEB[medio.tipo_medio];
    if (!tipoWeb) {
      motivos.push(`tipo_medio_no_soportado_en_redes:${mediaId}`);
      continue;
    }
    const bitacora = medio.bitacora_id ? ctx.bitacoraPorId.get(medio.bitacora_id) : null;
    if (!bitacora) {
      motivos.push(`bitacora_origen_no_encontrado:${mediaId}`);
      continue;
    }
    const srcReal = resolveRumboAsset(bitacora.ubicacion_bitacora);
    let sha256 = null;
    if (!srcReal || !fs.existsSync(srcReal)) {
      motivos.push(`archivo_faltante_en_disco:${mediaId}`);
    } else {
      sha256 = sha256OfFile(srcReal);
      if (bitacora.hash_copia_sha256 && sha256 !== bitacora.hash_copia_sha256) {
        motivos.push(`hash_no_coincide:${mediaId}`);
      }
    }

    if (!medio.licencia || medio.licencia === "pendiente") motivos.push(`falta_licencia:${mediaId}`);
    if (!esSi(medio.derechos_confirmados)) motivos.push(`derechos_no_confirmados:${mediaId}`);

    const tipoRedes = medio.tipo_medio === "fotografia" ? "imagen" : "video";
    if (tipoRedes === "imagen") contadorImagen++;
    else contadorVideo++;
    const numeroDelTipo = tipoRedes === "imagen" ? contadorImagen : contadorVideo;
    const ext = path.extname(bitacora.nombre_original || "").toLowerCase();
    const nombreArchivo = `pub-${sufijoId(publicacionId)}__${tipoRedes}-${String(numeroDelTipo).padStart(2, "0")}${ext}`;

    let urlPublica = null;
    if (ctx.publicSiteBaseUrl && medio.status === "published" && srcReal && fs.existsSync(srcReal)) {
      const destName = safeMediaName(medio.media_id, bitacora.nombre_original);
      urlPublica = `${ctx.publicSiteBaseUrl}/data/rumbo/archivos/${tipoWeb}/${destName}`;
    }

    // ruta_onedrive debe ser la ruta completa desde la raiz de My Drive hacia
    // la copia plana en 05_LISTOS_PUBLICAR (lo unico que Make puede descargar
    // con "OneDrive > Download a File"), no la ubicacion original dispersa.
    let rutaOnedrive = null;
    if (MYDRIVE_RUMBO_ROOT) {
      rutaOnedrive = `${MYDRIVE_RUMBO_ROOT}/05_LISTOS_PUBLICAR/${nombreArchivo}`;
    } else {
      motivos.push(`no_se_pudo_calcular_ruta_onedrive_my_drive:${mediaId}`);
    }

    medios.push({
      orden: medios.length + 1,
      media_id: medio.media_id,
      tipo: tipoRedes,
      nombre_archivo: nombreArchivo,
      mime_type: MIME_POR_EXT[ext] || "application/octet-stream",
      sha256: sha256 || null,
      ruta_onedrive: rutaOnedrive,
      url_publica: urlPublica,
      autor: bitacora.autor || null,
      licencia: medio.licencia || null,
      derechos_confirmados: esSi(medio.derechos_confirmados),
      __srcReal: srcReal,
    });
  }

  if (publicarInstagram && !pubRow.formato_instagram) {
    motivos.push("falta_formato_instagram");
  } else if (publicarInstagram && medios.length > 0 && !formatoInstagramCompatible(pubRow.formato_instagram, contadorImagen, contadorVideo)) {
    motivos.push("formato_instagram_incompatible_con_medios");
  }
  if (publicarFacebook && !pubRow.formato_facebook) {
    motivos.push("falta_formato_facebook");
  } else if (publicarFacebook && medios.length > 0 && !formatoFacebookCompatible(pubRow.formato_facebook, contadorImagen, contadorVideo)) {
    motivos.push("formato_facebook_incompatible_con_medios");
  }

  if (publicarInstagram && !ctx.publicSiteBaseUrl) {
    motivos.push("falta_url_publica_instagram");
  }

  const permitirPublicacion = motivos.length === 0;

  const manifest = {
    schema_version: SCHEMA_VERSION,
    publicacion_id: publicacionId,
    historia_id: pubRow.historia_id || null,
    carrera_id: pubRow.carrera_id || null,
    estado: permitirPublicacion ? "lista_para_publicar" : "bloqueada",
    aprobado_por: pubRow.aprobado_por || null,
    fecha_aprobacion: pubRow.fecha_aprobacion || null,
    publicar_instagram: publicarInstagram,
    publicar_facebook: publicarFacebook,
    formato_instagram: pubRow.formato_instagram || null,
    formato_facebook: pubRow.formato_facebook || null,
    texto_instagram: pubRow.texto_instagram || "",
    texto_facebook: pubRow.texto_facebook || "",
    // Idempotencia y control por red (v1.1)
    marca_idempotencia: marcaIdempotenciaDe(publicacionId),
    redes_autorizadas: [
      publicarFacebook ? "facebook" : null,
      publicarInstagram ? "instagram" : null,
    ].filter(Boolean),
    redes_completadas: redesCompletadas, // ya publicadas (con post_id): Make NO las repite
    omitir_redes: omitirRedes,
    es_reintento: esReintento,
    medios: medios.map(({ __srcReal, ...m }) => m),
    cantidad_medios: medios.length,
    permitir_publicacion: permitirPublicacion,
    motivos_bloqueo: motivos,
  };

  return { manifest, motivos, mediosConRuta: medios };
}

function sufijoId(publicacionId) {
  // "pub-20260720-turi-01" -> "20260720-turi-01" (evita "pub-pub-" en el nombre plano)
  return String(publicacionId || "").replace(/^pub-/, "");
}

function formatoInstagramCompatible(formato, nImagen, nVideo) {
  switch (formato) {
    case "foto":
      return nImagen === 1 && nVideo === 0;
    case "carrusel":
      return nImagen + nVideo >= 2;
    case "reel":
      return nVideo === 1 && nImagen === 0;
    default:
      return false;
  }
}

function formatoFacebookCompatible(formato, nImagen, nVideo) {
  switch (formato) {
    case "post":
      return true;
    case "fotos":
      return nImagen >= 1;
    case "video":
      return nVideo === 1;
    case "reel":
      return nVideo === 1;
    default:
      return false;
  }
}

// --- Preparacion real: copia archivos, escribe manifiesto, crea el marcador ---

async function prepararPublicacion(pubRow, ctx, ws21, colIndex) {
  const { manifest, motivos, mediosConRuta } = validarPublicacion(pubRow, ctx);

  if (motivos.length > 0) {
    console.error(`\nBLOQUEADA ${pubRow.publicacion_id}: no se prepara ningun archivo. Motivos:`);
    for (const m of motivos) console.error(`  - ${m}`);
    escribirAuditoriaBloqueo(ws21, pubRow.__row, colIndex, motivos);
    return { ok: false, motivos };
  }

  await fsp.mkdir(LISTOS_DIR, { recursive: true });

  const archivosCopiados = [];
  for (const medio of mediosConRuta) {
    const destino = path.join(LISTOS_DIR, medio.nombre_archivo);
    await fsp.copyFile(medio.__srcReal, destino);
    archivosCopiados.push(medio.nombre_archivo);
  }

  // El manifiesto se escribe primero con un nombre que NO contiene
  // "LISTO_PARA_PUBLICAR", para que Make nunca pueda verlo a medio escribir.
  // Solo al final se renombra al nombre real del marcador (operacion atomica).
  const nombreFinal = `${MARKER_PREFIX}__${pubRow.publicacion_id}.json`;
  const nombreTemporal = `.preparando__${pubRow.publicacion_id}.json`;
  const rutaTemporal = path.join(LISTOS_DIR, nombreTemporal);
  const rutaFinal = path.join(LISTOS_DIR, nombreFinal);
  await fsp.writeFile(rutaTemporal, JSON.stringify(manifest, null, 2), "utf-8");
  await fsp.rename(rutaTemporal, rutaFinal);

  const hashes = mediosConRuta.map((m) => m.sha256);
  const fechaPreparacion = new Date().toISOString();
  const fila = ws21.getRow(pubRow.__row);
  const setIf = (name, val) => {
    if (colIndex[name]) fila.getCell(colIndex[name]).value = val;
  };
  setIf("estado", "lista_para_publicar");
  setIf("fecha_preparacion", fechaPreparacion);
  setIf("archivos", archivosCopiados.join(", "));
  setIf("hashes_sha256", hashes.join(", "));
  setIf("motivos_bloqueo_ultima_validacion", "");

  // Inicializacion de estado/intentos por red (v1.1). En un reintento se
  // conservan los intentos y los estados ya publicados.
  const estadoRed = (red) =>
    manifest[`publicar_${red}`]
      ? manifest.omitir_redes.includes(red)
        ? "publicada"
        : "pendiente"
      : "no_aplica";
  setIf("facebook_estado", estadoRed("facebook"));
  setIf("instagram_estado", estadoRed("instagram"));
  if (!manifest.es_reintento) {
    setIf("facebook_intentos", 0);
    setIf("instagram_intentos", 0);
  }

  console.log(`\nLISTA PARA PUBLICAR: ${pubRow.publicacion_id}`);
  console.log(`  Archivos copiados a ${LISTOS_DIR}:`);
  for (const f of archivosCopiados) console.log(`    - ${f}`);
  console.log(`  Marcador creado: ${nombreFinal}`);
  return { ok: true, manifest };
}

function escribirAuditoriaBloqueo(ws21, rowIndex, colIndex, motivos) {
  const row = ws21.getRow(rowIndex);
  row.getCell(colIndex.estado).value = "bloqueada";
  row.getCell(colIndex.motivos_bloqueo_ultima_validacion).value = motivos.join(", ");
}

// Acceso a columnas de 21_PUBLICACIONES_REDES por nombre de encabezado (fila 4),
// para no depender de indices fijos si se reordenan columnas.
function indexarColumnasPorNombre(ws) {
  const headerRow = ws.getRow(4);
  const porNombre = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const nombre = String(cell.value ?? "").trim();
    if (nombre) porNombre[nombre] = colNumber;
  });
  return porNombre;
}

// --- CLI ---

function parseArgs(argv) {
  const args = { validar: false, publicacionId: null };
  for (const a of argv) {
    if (a === "--validar") args.validar = true;
    else if (a.startsWith("--publicacion-id=")) args.publicacionId = a.split("=")[1];
    else if (a === "--publicacion-id") args.__esperandoId = true;
    else if (args.__esperandoId) {
      args.publicacionId = a;
      args.__esperandoId = false;
    }
  }
  return args;
}

function imprimirReporteValidacion(pubRow, resultado) {
  const { motivos } = resultado;
  if (motivos.length === 0) {
    console.log(`\nOK ${pubRow.publicacion_id}: cumple todas las reglas de seguridad. permitir_publicacion=true.`);
  } else {
    console.log(`\nBLOQUEADA ${pubRow.publicacion_id}: permitir_publicacion=false. Motivos:`);
    for (const m of motivos) console.log(`  - ${m}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { workbook } = await abrirExcel();
  const ctx = cargarContexto(workbook);

  // Mapear celdas de 21_PUBLICACIONES_REDES por nombre de columna para poder
  // escribir por nombre sin depender de indices fijos.
  const ws21 = workbook.getWorksheet("21_PUBLICACIONES_REDES");
  const colIndex = indexarColumnasPorNombre(ws21);

  if (ctx.publicacionesRows.length === 0 && !args.publicacionId) {
    console.log("No hay publicaciones registradas todavia en 21_PUBLICACIONES_REDES. Nada que validar o preparar.");
    return;
  }

  const objetivo = args.publicacionId
    ? ctx.publicacionesRows.filter((r) => r.publicacion_id === args.publicacionId)
    : ctx.publicacionesRows;

  if (args.publicacionId && objetivo.length === 0) {
    console.error(`No se encontro publicacion_id "${args.publicacionId}" en 21_PUBLICACIONES_REDES.`);
    process.exitCode = 1;
    return;
  }

  if (args.validar) {
    let algunBloqueo = false;
    for (const pubRow of objetivo) {
      const resultado = validarPublicacion(pubRow, ctx);
      imprimirReporteValidacion(pubRow, resultado);
      if (resultado.motivos.length > 0) algunBloqueo = true;
    }
    if (algunBloqueo) process.exitCode = 1;
    return;
  }

  if (!args.publicacionId) {
    console.error(
      "Modo de preparacion real: se requiere --publicacion-id=<id> (usa --validar para revisar varias publicaciones a la vez sin escribir nada)."
    );
    process.exitCode = 1;
    return;
  }

  const pubRow = objetivo[0];
  const resultado = await prepararPublicacion(pubRow, ctx, ws21, colIndex);

  // Se escribe el Excel tanto si quedo lista (estado=lista_para_publicar,
  // archivos, hashes) como si quedo bloqueada (estado=bloqueada, motivos de
  // auditoria) — nunca se crea el marcador LISTO_PARA_PUBLICAR en el caso
  // bloqueado, eso ya lo decidio prepararPublicacion.
  const xlsxFiles = fs.readdirSync(RUMBO_ROOT).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  const excelPath = path.join(RUMBO_ROOT, xlsxFiles[0]);
  await workbook.xlsx.writeFile(excelPath);

  if (!resultado.ok) {
    console.log(`\nExcel actualizado: fila de ${pubRow.publicacion_id} en 21_PUBLICACIONES_REDES (bloqueada).`);
    process.exitCode = 1;
  } else {
    console.log(`\nExcel actualizado: fila de ${pubRow.publicacion_id} en 21_PUBLICACIONES_REDES.`);
  }
}

main().catch((e) => {
  console.error("Fallo inesperado en preparar-publicacion-redes:", e);
  process.exitCode = 1;
});
