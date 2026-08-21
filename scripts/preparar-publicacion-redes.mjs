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
//
// La version del marcador (1.0 o 1.1) NO la decide este codigo: la decide la
// celda schema_marcador_redes_activo de 09_CONFIGURACION. --esquema= solo
// existe con --modo-prueba, para el harness.
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
import {
  necesitaDerivadoInstagram,
  nombreDerivadoInstagram,
} from "./lib/instagram-image.mjs";
import { resolverRumboRootCLI } from "./lib/rumbo-root.mjs";
import { comprobarSustituciones, numeroEnLimites } from "./lib/modo-prueba.mjs";

// La ubicacion de la carpeta operativa se resuelve en scripts/lib/rumbo-root.mjs
// con esta precedencia: RUMBO_ONEDRIVE_ROOT -> rumbo.config.json -> deteccion
// -> error accionable. Nunca hay un fallback silencioso a una ruta inexistente.
const { root: RUMBO_ROOT, config: RUMBO_CONFIG } = resolverRumboRootCLI();
const LISTOS_DIR = path.join(RUMBO_ROOT, "05_LISTOS_PUBLICAR");
const MARKER_PREFIX = "LISTO_PARA_PUBLICAR";

// Esquemas del marcador que este codigo sabe emitir. La version ACTIVA no la
// decide el codigo: la decide la celda schema_marcador_redes_activo de
// 09_CONFIGURACION. Aqui solo se declara lo que se sabe hacer.
const ESQUEMAS_SOPORTADOS = ["1.0", "1.1"];
const CLAVE_ESQUEMA = "schema_marcador_redes_activo";

// --- Modo de prueba ---
//
// Igual disciplina que la rutina 09: las variables que pueden desviar adonde se
// mira o que esquema se emite solo valen con --modo-prueba explicito. En una
// ejecucion operativa, encontrarlas definidas aborta.
const MODO_PRUEBA = process.argv.slice(2).includes("--modo-prueba");
// Solo para el harness: omite las peticiones HTTP. En operacion no existe.
const SIN_RED = MODO_PRUEBA && process.argv.slice(2).includes("--sin-red");
const SUSTITUCIONES_PELIGROSAS = ["RUMBO_SITE_BASE_URL"];

const LIMITES_RED = {
  RUMBO_TIMEOUT_PETICION_MS: { min: 500, max: 120_000, pordefecto: 15_000 },
  RUMBO_MAX_BYTES_MEDIO: { min: 1_000, max: 500_000_000, pordefecto: 50_000_000 },
};

function abortar(mensaje) {
  console.error(`
${mensaje}
`);
  process.exit(1);
}

comprobarSustituciones(SUSTITUCIONES_PELIGROSAS, { modoPrueba: MODO_PRUEBA, alAbortar: abortar });

const TIMEOUT_MS = numeroEnLimites("RUMBO_TIMEOUT_PETICION_MS", LIMITES_RED.RUMBO_TIMEOUT_PETICION_MS, {
  alAbortar: abortar,
});
const MAX_BYTES = numeroEnLimites("RUMBO_MAX_BYTES_MEDIO", LIMITES_RED.RUMBO_MAX_BYTES_MEDIO, {
  alAbortar: abortar,
});

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
  if (MODO_PRUEBA && process.env.RUMBO_SITE_BASE_URL) {
    publicSiteBaseUrl = process.env.RUMBO_SITE_BASE_URL.replace(/\/+$/, "");
  }

  // Version activa del marcador. NO se infiere ni se degrada: si la celda falta,
  // esta vacia o pide una version que este codigo no sabe emitir, la rutina se
  // niega a ejecutarse y dice donde mirar. Una degradacion silenciosa aqui
  // significaria emitir un contrato que el escenario de Make no espera.
  const esquemaRow = configRows.find((r) => r.config_key === CLAVE_ESQUEMA);
  const esquemaCrudo = esquemaRow ? String(esquemaRow.valor ?? "").trim() : "";
  const esquemaArg = MODO_PRUEBA
    ? (process.argv.slice(2).find((a) => a.startsWith("--esquema=")) ?? "").split("=")[1]
    : undefined;
  const esquema = esquemaArg || esquemaCrudo;

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
    esquema,
    esquemaCrudo,
    esquemaArg,
  };
}

function exigirEsquemaValido(ctx) {
  if (!ctx.esquema) {
    abortar(
      `No hay version activa del marcador.

` +
        `  Falta o esta vacia la fila "${CLAVE_ESQUEMA}" en la hoja 09_CONFIGURACION.
` +
        `  Una celda vacia NO se interpreta como 1.0: la version debe declararse.

` +
        `  Versiones que este codigo sabe emitir: ${ESQUEMAS_SOPORTADOS.join(", ")}.`
    );
  }
  if (!ESQUEMAS_SOPORTADOS.includes(ctx.esquema)) {
    abortar(
      `Version de marcador no soportada: "${ctx.esquema}".

` +
        `  Declarada en: ${ctx.esquemaArg ? "--esquema (modo de prueba)" : `09_CONFIGURACION / ${CLAVE_ESQUEMA}`}
` +
        `  Este codigo sabe emitir: ${ESQUEMAS_SOPORTADOS.join(", ")}.

` +
        `  No se degrada a la version mas cercana: se detiene.`
    );
  }
}

// Paquete web local generado por sync-rumbo. Es la fuente de la que salen las
// URL publicas: no se recomponen por separado, se leen de medios.json, para que
// la rutina 10 no pueda inventar una URL que el generador nunca produjo.
function cargarPaqueteWeb() {
  const dir = path.join(process.cwd(), "public", "data", "rumbo");
  const leer = (n) => {
    const f = path.join(dir, n);
    if (!fs.existsSync(f)) return null;
    try {
      return JSON.parse(fs.readFileSync(f, "utf-8"));
    } catch {
      return null;
    }
  };
  const manifest = leer("manifest.json");
  const medios = leer("medios.json");
  const porMediaId = new Map();
  for (const m of (medios && medios.medios) || []) porMediaId.set(m.mediaId, m);
  return { dir, manifest, porMediaId };
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
  const avisos = [];
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
    // "publicada" cuenta igual que "confirmada": es el estado al que la propia
    // rutina 09 promueve la Carrera al publicar el sitio, y publicar en la web
    // no puede inhabilitar la publicacion en redes. Aceptar solo "confirmada"
    // hacia que 09 y 10 se contradijeran y bloqueaba toda jornada ya publicada.
    // La linea equivalente de Historia ya contemplaba ambos estados.
    else if (!["confirmada", "publicada"].includes(carrera.status)) {
      motivos.push("carrera_no_confirmada");
    }
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
  // Facebook "post" es texto y enlace: no llevar medios es lo correcto, no un
  // error. Instagram siempre publica medios, asi que ahi seguir exigiendolos.
  const soloPostDeFacebook =
    publicarFacebook && !publicarInstagram && pubRow.formato_facebook === "post";
  if (mediaIds.length === 0 && !soloPostDeFacebook) motivos.push("sin_medios");

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
    // Distincion deliberada: una ubicacion VACIA en el Excel es una carencia de
    // trazabilidad (aviso), mientras que una ubicacion declarada que no resuelve
    // a un archivo es una incoherencia real (bloqueo). Las rendiciones que Make
    // consume salen del paquete web, no de aqui.
    const ubicacionDeclarada = String(bitacora.ubicacion_bitacora ?? "").trim();
    const srcReal = ubicacionDeclarada ? resolveRumboAsset(ubicacionDeclarada) : null;
    let sha256 = null;
    if (!ubicacionDeclarada) {
      // sin ruta declarada no hay nada que verificar; se avisa mas abajo
    } else if (!srcReal || !fs.existsSync(srcReal)) {
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

    // La rendicion publica NO se recompone: se lee de medios.json, que es lo que
    // sync-rumbo genero de verdad. Si el medio no esta ahi, es que su jornada no
    // era publicable o el archivo no se copio, y no hay URL que ofrecer.
    const enPaquete = ctx.paqueteWeb.porMediaId.get(medio.media_id) || null;
    let urlPublica = null;
    let urlInstagram = null;
    let rutaWebPublica = null;
    let rutaWebInstagram = null;
    if (!enPaquete || !enPaquete.rutaWeb) {
      motivos.push(`medio_no_esta_en_el_paquete_web:${mediaId}`);
    } else {
      rutaWebPublica = enPaquete.rutaWeb;
      rutaWebInstagram = enPaquete.rutaWeb;
      // Instagram Foto exige relacion de aspecto 0.8..1.91. Si la imagen esta
      // fuera de rango, Instagram debe recibir el DERIVADO que genero
      // sync-rumbo; Facebook sigue recibiendo el original, que es la diferencia
      // que el esquema 1.1 hace explicita con dos listas separadas.
      if (publicarInstagram && tipoRedes === "imagen") {
        const ig = enPaquete.instagram;
        if (ig && ig.requiereDerivado) {
          if (ig.rutaWebInstagram) rutaWebInstagram = ig.rutaWebInstagram;
          else motivos.push(`error_preparacion_imagen_instagram:${medio.media_id}`);
        }
      }
      if (!ctx.publicSiteBaseUrl) {
        motivos.push("falta_url_publica");
      } else {
        urlPublica = `${ctx.publicSiteBaseUrl}/data/rumbo/${rutaWebPublica}`;
        urlInstagram = `${ctx.publicSiteBaseUrl}/data/rumbo/${rutaWebInstagram}`;
      }
    }

    // Solo trazabilidad, y literal: es el valor registrado en
    // 17_BITACORA_ARCHIVOS, sin recomponer ni normalizar. Si esta vacio se
    // omite; nunca se emite una ruta inventada. Make no la consume.
    const rutaFuenteRelativa = String(bitacora.ubicacion_bitacora ?? "").trim() || null;
    if (!rutaFuenteRelativa) avisos.push(`sin_ruta_fuente_registrada:${mediaId}`);

    const rutaDiscoPublica = rutaWebPublica ? path.join(ctx.paqueteWeb.dir, rutaWebPublica) : null;
    const rutaDiscoInstagram = rutaWebInstagram ? path.join(ctx.paqueteWeb.dir, rutaWebInstagram) : null;
    if (rutaDiscoPublica && !fs.existsSync(rutaDiscoPublica)) {
      motivos.push(`medio_no_esta_en_el_paquete_web:${mediaId}`);
    }

    medios.push({
      orden: medios.length + 1,
      media_id: medio.media_id,
      tipo: tipoRedes,
      nombre_archivo: nombreArchivo,
      mime_type: MIME_POR_EXT[ext] || "application/octet-stream",
      sha256: sha256 || null,
      url_publica: urlPublica,
      autor: bitacora.autor || null,
      licencia: medio.licencia || null,
      derechos_confirmados: esSi(medio.derechos_confirmados),
      // Campos internos (prefijo __): nunca llegan al marcador.
      __srcReal: srcReal,
      __rutaFuenteRelativa: rutaFuenteRelativa,
      __urlInstagram: urlInstagram,
      __discoPublica: rutaDiscoPublica,
      __discoInstagram: rutaDiscoInstagram,
      __ext: ext,
    });
  }

  if (publicarInstagram && !pubRow.formato_instagram) {
    motivos.push("falta_formato_instagram");
  } else if (publicarInstagram && medios.length > 0 && !formatoInstagramCompatible(pubRow.formato_instagram, contadorImagen, contadorVideo)) {
    motivos.push("formato_instagram_incompatible_con_medios");
  }
  if (publicarFacebook && !pubRow.formato_facebook) {
    motivos.push("falta_formato_facebook");
  } else if (publicarFacebook && pubRow.formato_facebook === "post" && mediaIds.length > 0) {
    // Motivo propio: no es una incompatibilidad de recuento, es un formato que
    // no admite medios en absoluto.
    motivos.push("formato_post_no_admite_medios");
  } else if (
    publicarFacebook &&
    medios.length > 0 &&
    !formatoFacebookCompatible(pubRow.formato_facebook, contadorImagen, contadorVideo)
  ) {
    motivos.push("formato_facebook_incompatible_con_medios");
  }

  // Facebook tambien descarga desde el sitio publicado: la URL dejo de ser
  // exclusiva de Instagram.
  if ((publicarInstagram || publicarFacebook) && !ctx.publicSiteBaseUrl) {
    motivos.push("falta_url_publica");
  }

  const permitirPublicacion = motivos.length === 0;

  const manifest = {
    schema_version: ctx.esquema,
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
    cantidad_medios: medios.length,
    permitir_publicacion: permitirPublicacion,
    motivos_bloqueo: motivos,
  };

  if (ctx.esquema === "1.0") {
    // Contrato historico, intacto: los binarios se copian a 05 y Make los
    // descarga con "OneDrive > Download a File" usando ruta_onedrive.
    manifest.medios = medios.map(({ media_id, tipo, nombre_archivo, mime_type, sha256, url_publica, autor, licencia, derechos_confirmados, orden }) => ({
      orden,
      media_id,
      tipo,
      nombre_archivo,
      mime_type,
      sha256,
      ruta_onedrive: rutaOnedriveDe(nombre_archivo, ctx),
      url_publica,
      autor,
      licencia,
      derechos_confirmados,
    }));
  } else {
    // Contrato 1.1: medios[] es inventario editorial, y cada red recibe su
    // propia lista de primer nivel con los archivos ya en orden.
    manifest.media_source = "public_url";
    manifest.medios = medios.map((m) => ({
      orden: m.orden,
      media_id: m.media_id,
      tipo: m.tipo,
      autor: m.autor,
      licencia: m.licencia,
      derechos_confirmados: m.derechos_confirmados,
      ...(m.__rutaFuenteRelativa
        ? { fuente: { ruta_fuente_relativa: m.__rutaFuenteRelativa, sha256_fuente: m.sha256 } }
        : {}),
    }));
    // Siempre presentes, vacias cuando no aplican: un iterador sobre lista
    // vacia itera cero veces y termina limpiamente; sobre un campo ausente
    // puede fallar en ejecucion.
    manifest.facebook_media = publicarFacebook ? medios.map((m, i) => rendicion(m, i, "facebook")) : [];
    manifest.instagram_media = publicarInstagram ? medios.map((m, i) => rendicion(m, i, "instagram")) : [];
  }

  return { manifest, motivos, avisos, mediosConRuta: medios };
}

// En 1.0 la ruta apunta a la copia plana de 05, que en ese esquema si existe.
// Se conserva el calculo historico para no romper el escenario personal.
function rutaOnedriveDe(nombreArchivo, ctx) {
  const raiz = String(ctx.myDriveRelativeRoot ?? "").trim();
  return raiz ? `${raiz}/05_LISTOS_PUBLICAR/${nombreArchivo}` : null;
}

function rendicion(m, i, red) {
  const url = red === "instagram" ? m.__urlInstagram : m.url_publica;
  const disco = red === "instagram" ? m.__discoInstagram : m.__discoPublica;
  const nombre = url ? url.split("/").pop() : null;
  let bytes = null;
  let sha = null;
  if (disco && fs.existsSync(disco)) {
    const st = fs.statSync(disco);
    bytes = st.size;
    sha = sha256OfFile(disco);
  }
  return {
    orden: i + 1,
    media_id: m.media_id,
    nombre_archivo: nombre,
    url_publica: url,
    mime_type: m.mime_type,
    tamano_bytes: bytes,
    sha256: sha,
  };
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

// "post" usa el modulo Create a Post, que es de texto y enlace: NO tiene campo
// de fotografia. Aceptar medios en ese formato los perdia en silencio — se
// publicaba el texto y los medios no llegaban a ninguna parte, sin error ni
// aviso. Por eso ahora exige cero medios y tiene motivo propio.
function formatoFacebookCompatible(formato, nImagen, nVideo) {
  switch (formato) {
    case "post":
      return nImagen === 0 && nVideo === 0;
    case "fotos":
      return nImagen >= 1 && nVideo === 0;
    case "video":
      return nVideo === 1 && nImagen === 0;
    case "reel":
      return nVideo === 1 && nImagen === 0;
    default:
      return false;
  }
}

// --- Verificacion remota por streaming ---
//
// Que una URL responda 200 no prueba que sirva el archivo que creemos: un
// archivo distinto del mismo tamano y tipo pasaria esa comprobacion. Por eso el
// hash es obligatorio en 1.1, y se calcula leyendo el cuerpo por trozos: cada
// trozo entra al hash y se descarta, asi que no se acumula el archivo en
// memoria y no se abre ningun descriptor. No hay temporales que limpiar porque
// no se crea ninguno, ni en el camino de exito ni en el de error.
async function verificarRemoto(url, { sha256Esperado, bytesEsperados, mimeEsperado }) {
  let res;
  try {
    res = await fetch(url, {
      redirect: "manual", // una 3xx es fallo: Vercel sirve los estaticos directamente
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
  } catch (e) {
    const causa = e && e.name === "TimeoutError" ? "timeout" : "sin_respuesta";
    return { ok: false, motivo: causa, detalle: String((e && e.message) || e) };
  }
  if (res.status !== 200) {
    if (res.body) await res.body.cancel().catch(() => {});
    return { ok: false, motivo: "http", detalle: String(res.status) };
  }
  const contentType = String(res.headers.get("content-type") || "").split(";")[0].trim();
  if (mimeEsperado && contentType && contentType !== mimeEsperado) {
    if (res.body) await res.body.cancel().catch(() => {});
    return { ok: false, motivo: "mime", detalle: `${contentType} != ${mimeEsperado}` };
  }
  const declarado = Number(res.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_BYTES) {
    if (res.body) await res.body.cancel().catch(() => {});
    return { ok: false, motivo: "excede_maximo", detalle: `${declarado} > ${MAX_BYTES}` };
  }

  const hash = crypto.createHash("sha256");
  let recibidos = 0;
  try {
    for await (const trozo of res.body) {
      recibidos += trozo.length;
      // Doble corte: la cabecera puede mentir, lo recibido no.
      if (recibidos > MAX_BYTES) {
        await res.body.cancel().catch(() => {});
        return { ok: false, motivo: "excede_maximo", detalle: `${recibidos} > ${MAX_BYTES}` };
      }
      hash.update(trozo);
    }
  } catch (e) {
    return { ok: false, motivo: "sin_respuesta", detalle: String((e && e.message) || e) };
  }
  const obtenido = hash.digest("hex");
  if (bytesEsperados != null && recibidos !== bytesEsperados) {
    return { ok: false, motivo: "bytes", detalle: `${recibidos} != ${bytesEsperados}` };
  }
  if (sha256Esperado && obtenido !== sha256Esperado) {
    return { ok: false, motivo: "hash", detalle: `${obtenido.slice(0, 12)} != ${sha256Esperado.slice(0, 12)}` };
  }
  return { ok: true, codigo_http: 200, content_type: contentType, content_length: recibidos, sha256_remoto: obtenido };
}

// Comprueba todas las rendiciones del marcador, deduplicando por URL+hash: si
// Facebook e Instagram comparten archivo, se descarga una sola vez.
async function verificarRendiciones(manifest) {
  const porClave = new Map();
  for (const lista of ["facebook_media", "instagram_media"]) {
    for (const r of manifest[lista] || []) {
      if (!r.url_publica) continue;
      const clave = `${r.url_publica}::${r.sha256 ?? ""}`;
      if (!porClave.has(clave)) porClave.set(clave, { rendicion: r, referencias: [] });
      porClave.get(clave).referencias.push(r);
    }
  }
  const motivos = [];
  let peticiones = 0;
  for (const { rendicion: r, referencias } of porClave.values()) {
    peticiones++;
    const res = await verificarRemoto(r.url_publica, {
      sha256Esperado: r.sha256,
      bytesEsperados: r.tamano_bytes,
      mimeEsperado: r.mime_type,
    });
    if (!res.ok) {
      const motivo =
        res.motivo === "hash"
          ? `url_publica_hash_no_coincide:${r.media_id}`
          : res.motivo === "mime"
            ? `mime_remoto_incoherente:${r.media_id}`
            : res.motivo === "excede_maximo"
              ? `medio_excede_tamano:${r.media_id}`
              : `url_publica_no_responde:${r.media_id}:${res.motivo === "http" ? res.detalle : res.motivo}`;
      motivos.push(motivo);
      console.error(`  ! ${motivo}`);
      console.error(`      URL       : ${r.url_publica}`);
      console.error(`      esperado  : sha256=${r.sha256 ?? "-"} bytes=${r.tamano_bytes ?? "-"}`);
      console.error(`      obtenido  : ${res.detalle}`);
    }
    // El resultado se copia a todas las referencias que comparten archivo.
    for (const ref of referencias) {
      ref.verificacion = res.ok
        ? { ...res, coincide: true, comprobado_en: new Date().toISOString() }
        : { coincide: false, motivo: res.motivo, detalle: res.detalle, comprobado_en: new Date().toISOString() };
      delete ref.verificacion.ok;
    }
  }
  return { motivos, peticiones, distintos: porClave.size };
}

// --- Verificacion de que la generacion web esta confirmada ---
//
// Aborto global: si la publicacion web no esta confirmada, o el sitio sirve otra
// generacion, no tiene sentido evaluar medios uno a uno.
function verificarGeneracionConfirmada(ctx, wb) {
  const m = ctx.paqueteWeb.manifest;
  if (!m || !m.publicacionWebId) return ["publicacion_web_no_confirmada"];
  const espejo = path.join(process.cwd(), "src", "data", "generated", "rumbo-web", "manifest.json");
  if (fs.existsSync(espejo)) {
    try {
      const otro = JSON.parse(fs.readFileSync(espejo, "utf-8"));
      if (otro.publicacionWebId !== m.publicacionWebId) return ["generacion_web_desfasada"];
    } catch {
      return ["generacion_web_desfasada"];
    }
  }
  const ws = wb.getWorksheet("01_HISTORIAL_COWORK");
  if (!ws) return ["publicacion_web_no_confirmada"];
  const col = {};
  ws.getRow(4).eachCell({ includeEmpty: false }, (c, n) => (col[String(c.value ?? "").trim()] = n));
  for (let r = 5; r <= ws.rowCount; r++) {
    const idOrigen = col.id_origen ? String(ws.getRow(r).getCell(col.id_origen).value ?? "").trim() : "";
    const resultado = col.resultado ? String(ws.getRow(r).getCell(col.resultado).value ?? "") : "";
    if (idOrigen === m.publicacionWebId && /^despliegue confirmado/i.test(resultado)) return [];
  }
  return ["publicacion_web_no_confirmada"];
}

// --- Preparacion real: copia archivos, escribe manifiesto, crea el marcador ---

async function prepararPublicacion(pubRow, ctx, ws21, colIndex, wb) {
  const { manifest, motivos, avisos, mediosConRuta } = validarPublicacion(pubRow, ctx);

  // Aborto global antes de mirar medio por medio: si la generacion web no esta
  // confirmada, o el sitio sirve otra, no tiene sentido evaluar nada mas.
  if (ctx.esquema === "1.1") motivos.push(...verificarGeneracionConfirmada(ctx, wb));

  // Verificacion remota obligatoria en 1.1, y solo si no hay ya otros motivos:
  // no se gastan peticiones sobre un marcador que ya esta bloqueado.
  let verificacion = null;
  if (ctx.esquema === "1.1" && motivos.length === 0 && !SIN_RED) {
    verificacion = await verificarRendiciones(manifest);
    motivos.push(...verificacion.motivos);
  }

  if (motivos.length > 0) {
    console.error(`\nBLOQUEADA ${pubRow.publicacion_id}: no se prepara ningun archivo. Motivos:`);
    for (const m of motivos) console.error(`  - ${m}`);
    escribirAuditoriaBloqueo(ws21, pubRow.__row, colIndex, motivos);
    return { ok: false, motivos };
  }
  for (const a of avisos) console.log(`  aviso: ${a}`);

  await fsp.mkdir(LISTOS_DIR, { recursive: true });

  // En 1.1 los binarios NO se copian: Make los obtiene por URL desde el sitio
  // publicado, asi que copiarlos seria trabajo sin ningun consumidor. En 05
  // queda unicamente el JSON del marcador.
  const archivosCopiados = [];
  if (ctx.esquema === "1.0") {
    for (const medio of mediosConRuta) {
      const destino = path.join(LISTOS_DIR, medio.nombre_archivo);
      await fsp.copyFile(medio.__srcReal, destino);
      archivosCopiados.push(medio.nombre_archivo);
    }
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
  console.log(`  Esquema del marcador: ${ctx.esquema}`);
  if (ctx.esquema === "1.0") {
    console.log(`  Archivos copiados a ${LISTOS_DIR}:`);
    for (const f of archivosCopiados) console.log(`    - ${f}`);
  } else {
    console.log(`  En 05_LISTOS_PUBLICAR solo se coloca el JSON: ningun binario copiado.`);
    if (verificacion) {
      console.log(
        `  Rendiciones verificadas: ${verificacion.distintos} distintas en ${verificacion.peticiones} peticiones.`
      );
    }
  }
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
    else if (a === "--modo-prueba" || a === "--sin-red" || a.startsWith("--esquema=")) continue;
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
  exigirEsquemaValido(ctx);
  ctx.paqueteWeb = cargarPaqueteWeb();
  ctx.myDriveRelativeRoot = RUMBO_CONFIG ? RUMBO_CONFIG.myDriveRelativeRoot : null;
  console.log(`Esquema activo del marcador: ${ctx.esquema}${ctx.esquemaArg ? " (--esquema, modo de prueba)" : ""}`);

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
    // Modo de solo lectura: no copia archivos, no escribe el Excel y no crea
    // ningun marcador. Tampoco hace peticiones: la verificacion remota vive en
    // la preparacion real.
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
  const resultado = await prepararPublicacion(pubRow, ctx, ws21, colIndex, workbook);

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
