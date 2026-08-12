// scripts/sync-rumbo.mjs
//
// Genera el paquete web de RUMBO (JSON/GeoJSON/medios) a partir del Excel
// maestro activo, y opcionalmente lo sincroniza hacia public/data/rumbo.
//
// Modos:
//   node scripts/sync-rumbo.mjs --generate   -> solo genera RUMBO/04_PUBLICACION_WEB
//   node scripts/sync-rumbo.mjs --sync       -> solo copia el paquete ya generado a public/data/rumbo
//   node scripts/sync-rumbo.mjs              -> hace ambas cosas en secuencia
//
// Nunca escribe en el Excel (lectura estricta). Nunca hace commit/push/deploy.

import ExcelJS from "exceljs";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  necesitaDerivadoInstagram,
  generarDerivadoInstagram,
  ratioDe,
} from "./lib/instagram-image.mjs";
import { resolverRumboRootCLI } from "./lib/rumbo-root.mjs";
import {
  esCarreraPublicable,
  esHistoriaPublicable,
  jornadasPublicables,
} from "./lib/publicables.mjs";
import {
  crearTemporal,
  descartarTemporal,
  sustituir,
  validarDirectorio,
} from "./lib/reemplazo-atomico.mjs";

// --- Configuración de rutas ---
// El root operativo de RUMBO vive fuera del codebase (hoy en OneDrive). Su
// ubicación se resuelve en scripts/lib/rumbo-root.mjs con esta precedencia:
// RUMBO_ONEDRIVE_ROOT -> rumbo.config.json -> detección -> error accionable.
// Nunca hay un fallback silencioso a una ruta que no existe.
const { root: RUMBO_ROOT, origen: ORIGEN_RUMBO_ROOT } = resolverRumboRootCLI();

const PAQUETE_DIR = path.join(RUMBO_ROOT, "04_PUBLICACION_WEB");
const CODEBASE_PUBLIC_DIR = path.join(
  process.cwd(),
  "public",
  "data",
  "rumbo"
);
// Espejo dentro de src/, solo de los .json (sin medios/geojson de rutas), para
// que la capa de datos del sitio pueda importarlos de forma estatica y segura
// (public/ no forma parte del grafo de modulos de Vite). Se versiona en git
// junto a public/data/rumbo, para que el build funcione sin acceso al Excel.
const CODEBASE_SRC_MIRROR_DIR = path.join(
  process.cwd(),
  "src",
  "data",
  "generated",
  "rumbo-web"
);
const JSON_FILES = [
  "resumen.json",
  "cantones.json",
  "cantones_visitados.geojson",
  "carreras.json",
  "historias.json",
  "bitacora.json",
  "medios.json",
  "manifest.json",
];

const ECUADOR_BBOX = { latMin: -5.5, latMax: 2, lonMin: -81.5, lonMax: -74.8 };

const warnings = [];
const errors = [];

function warn(msg) {
  warnings.push(msg);
  console.warn("ADVERTENCIA:", msg);
}
function err(msg) {
  errors.push(msg);
  console.error("ERROR:", msg);
}

// --- Utilidades de lectura de hojas ---

/** Lee una hoja tabular con encabezados en la fila 4 y datos desde la fila 5. */
function readSheet(workbook, sheetName) {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) {
    err(`Hoja no encontrada en el Excel: ${sheetName}`);
    return [];
  }
  const headerRow = ws.getRow(4);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows = [];
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const firstCell = row.getCell(1).value;
    if (firstCell === null || firstCell === undefined || String(firstCell).trim() === "") {
      continue; // fila vacia, se ignora (no se asume fin de tabla por si hay huecos)
    }
    const obj = {};
    for (let c = 1; c < headers.length; c++) {
      if (!headers[c]) continue;
      const cell = row.getCell(c);
      let value = cell.value;
      if (value && typeof value === "object" && "text" in value) value = value.text; // rich text
      if (value && typeof value === "object" && value instanceof Date) value = value.toISOString();
      obj[headers[c]] = value === undefined ? null : value;
    }
    rows.push(obj);
  }
  return rows;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inEcuador(lat, lon) {
  if (lat === null || lon === null) return false;
  return (
    lat >= ECUADOR_BBOX.latMin &&
    lat <= ECUADOR_BBOX.latMax &&
    lon >= ECUADOR_BBOX.lonMin &&
    lon <= ECUADOR_BBOX.lonMax
  );
}

function safeMediaName(mediaId, originalName) {
  const ext = path.extname(originalName || "").toLowerCase() || "";
  const safe = String(mediaId).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${safe}${ext}`;
}

// Resuelve una ruta de archivo declarada en el Excel (ubicacion_bitacora,
// geojson_onedrive_path, etc.). Estas rutas vienen como "RUMBO/..." y son
// relativas al contenedor de RUMBO_ROOT (su carpeta padre), no a RUMBO_ROOT.
// Antes el GeoJSON se resolvia con path.join(RUMBO_ROOT, rel), lo que duplicaba
// la carpeta RUMBO (".../RUMBO/RUMBO/03 TRABAJO COWORK/...") y no se encontraba.
function resolveRumboAsset(relOrAbs) {
  if (!relOrAbs) return null;
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.join(RUMBO_ROOT, "..", relOrAbs);
}

function centroidOfLineString(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const c of coordinates) {
    sumLon += c[0];
    sumLat += c[1];
  }
  return [sumLon / coordinates.length, sumLat / coordinates.length];
}

async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

function sha256OfFile(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

// --- Fase 1: GENERAR paquete en RUMBO/04_PUBLICACION_WEB ---

async function generatePackage() {
  console.log(`Leyendo Excel maestro desde: ${RUMBO_ROOT}  (${ORIGEN_RUMBO_ROOT})`);

  // 1. Confirmar el Excel activo declarado en 09_CONFIGURACION
  const xlsxFiles = fs
    .readdirSync(RUMBO_ROOT)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (xlsxFiles.length !== 1) {
    err(
      `Se esperaba exactamente 1 archivo .xlsx en la raiz de RUMBO, se encontraron ${xlsxFiles.length}: ${xlsxFiles.join(", ")}`
    );
  }
  const excelPath = path.join(RUMBO_ROOT, xlsxFiles[0]);
  const excelHash = sha256OfFile(excelPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const configRows = readSheet(workbook, "09_CONFIGURACION");
  const activeFilenameRow = configRows.find(
    (r) => r.config_key === "active_master_excel_filename"
  );
  if (activeFilenameRow && activeFilenameRow.valor !== xlsxFiles[0]) {
    err(
      `El archivo activo declarado en 09_CONFIGURACION (${activeFilenameRow.valor}) no coincide con el Excel encontrado (${xlsxFiles[0]})`
    );
  }

  const jornadas = readSheet(workbook, "02_JORNADAS");
  const carrerasRows = readSheet(workbook, "03_CARRERAS");
  const historiasRows = readSheet(workbook, "04_HISTORIAS");
  const mediosRows = readSheet(workbook, "05_MEDIOS");
  const rutasRows = readSheet(workbook, "06_RUTAS");
  const relacionesRows = readSheet(workbook, "08_RELACIONES");
  const provinciasRows = readSheet(workbook, "15_PROVINCIAS");
  const territorioRows = readSheet(workbook, "16_TERRITORIO");
  const bitacoraArchivosRows = readSheet(workbook, "17_BITACORA_ARCHIVOS");
  const archivosDerivadosRows = readSheet(workbook, "19_ARCHIVOS_DERIVADOS");
  const metricasRows = readSheet(workbook, "20_METRICAS_ATLETA");

  // --- Validaciones de identificadores/relaciones ---
  const routeIds = new Set();
  for (const r of rutasRows) {
    if (routeIds.has(r.route_id)) err(`route_id duplicado: ${r.route_id}`);
    routeIds.add(r.route_id);
  }
  const raceIds = new Set();
  for (const c of carrerasRows) {
    if (raceIds.has(c.race_id)) err(`race_id duplicado: ${c.race_id}`);
    raceIds.add(c.race_id);
    if (c.route_id && !routeIds.has(c.route_id)) {
      err(`Carrera ${c.race_id} referencia route_id inexistente: ${c.route_id}`);
    }
  }
  for (const r of rutasRows) {
    if (r.race_required === "Sí" && r.race_id && !raceIds.has(r.race_id)) {
      err(`Ruta ${r.route_id} tiene race_required=Si pero race_id ${r.race_id} no existe en 03_CARRERAS`);
    }
    if (!r.race_id) {
      warn(`Ruta ${r.route_id} sin race_id asociado (Ruta sin Carrera)`);
    }
  }
  const territorioByCantonId = new Map(territorioRows.map((t) => [t.territory_id, t]));
  for (const r of rutasRows) {
    if (r.canton_id && !territorioByCantonId.has(r.canton_id)) {
      err(`canton_id inexistente en 16_TERRITORIO: ${r.canton_id} (route_id ${r.route_id})`);
    }
  }
  const mediaIds = new Set();
  for (const m of mediosRows) {
    if (mediaIds.has(m.media_id)) err(`media_id duplicado: ${m.media_id}`);
    mediaIds.add(m.media_id);
  }

  // Indice de medios por id, para resolver el tipo real (05_MEDIOS) de los
  // activos relacionados con la Carrera cuando el asset_type es generico ("media").
  const mediosById = new Map(mediosRows.map((m) => [m.media_id, m]));
  function esFotografiaAsset(rel) {
    const t = String(rel.asset_type || "").toLowerCase();
    if (t === "photograph" || t === "fotografia") return true;
    if (t === "media") {
      const m = mediosById.get(rel.asset_id);
      return !!m && String(m.tipo_medio || "").toLowerCase() === "fotografia";
    }
    return false;
  }

  // Criterio unico de publicabilidad (scripts/lib/publicables.mjs). Todo lo que
  // se derive de Carreras usa ESTA lista, no una condicion propia: antes cada
  // seccion aplicaba una distinta —o ninguna— y el estado editorial del Excel
  // no gobernaba realmente lo que se publicaba.
  const carrerasPublicables = carrerasRows.filter(esCarreraPublicable);
  for (const c of carrerasRows) {
    if (!esCarreraPublicable(c)) {
      warn(`Carrera ${c.race_id} excluida del paquete (status="${c.status ?? ""}").`);
    }
  }

  // Jornadas que pueden aparecer en el sitio. Se calcula una sola vez porque lo
  // usan los medios y la Bitacora; si cada seccion lo dedujera por su cuenta
  // volveriamos a tener criterios paralelos.
  const { jornadas: jornadasVisibles } = jornadasPublicables({
    carrerasRows,
    historiasRows,
    jornadasRows: jornadas,
    rutasRows,
    bitacoraRows: bitacoraArchivosRows,
    relacionesRows,
  });
  const jornadaDeMedio = new Map();
  for (const b of bitacoraArchivosRows) {
    if (b.media_id && b.jornada_id) jornadaDeMedio.set(b.media_id, b.jornada_id);
  }

  // --- resumen.json ---
  const cantonesValidosVisitados = new Set(
    carrerasPublicables.map((c) => {
      const ruta = rutasRows.find((r) => r.route_id === c.route_id);
      return ruta ? ruta.canton_id : null;
    }).filter(Boolean)
  );

  let kmTotales = 0;
  const rutaVistaParaKm = new Set();
  for (const c of carrerasPublicables) {
    const ruta = rutasRows.find((r) => r.route_id === c.route_id);
    if (ruta && !rutaVistaParaKm.has(ruta.route_id)) {
      const km = toNumberOrNull(ruta.distancia_km);
      if (km !== null) kmTotales += km;
      rutaVistaParaKm.add(ruta.route_id);
    }
  }

  // Decision deliberada: VO2max, recuperacion, pasos y calorias NO se filtran
  // por publicabilidad de la Carrera. Son metricas generales del atleta, no
  // atributos de una jornada publicada; que no haya jornadas publicables no
  // significa que Fidel no tenga VO2max. Si alguna vez deben ocultarse, sera
  // por una decision editorial propia, no como efecto colateral de esta regla.
  const metricasValidas = metricasRows.filter((m) => m.status && m.status !== "rechazado");
  function ultimoValor(tipo) {
    const candidatos = metricasValidas
      .filter((m) => m.tipo_metrica === tipo && toNumberOrNull(m.valor) !== null)
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)));
    return candidatos.length ? toNumberOrNull(candidatos[0].valor) : null;
  }

  let caloriasSuma = 0;
  let caloriasCount = 0;
  for (const r of rutasRows) {
    const kcal = toNumberOrNull(r.calorias_kcal);
    if (kcal !== null) {
      caloriasSuma += kcal;
      caloriasCount++;
    }
  }

  // Pasos: 06_RUTAS todavia no tiene una columna dedicada (ni Cowork la
  // registra hoy). Se deja preparado para leer "pasos_totales" cuando exista
  // (ej. desde total_strides del FIT, si se confirma que corresponde a pasos
  // para el dispositivo/actividad). Nunca se estima a partir de la distancia.
  let pasosSuma = 0;
  let pasosCount = 0;
  for (const r of rutasRows) {
    const pasos = toNumberOrNull(r.pasos_totales);
    if (pasos !== null) {
      pasosSuma += pasos;
      pasosCount++;
    }
  }

  const provinciasIndicador = provinciasRows.find((p) => p.INDICADOR === "Provincias");
  const cantonesVigentesIndicador = provinciasRows.find((p) => p.INDICADOR === "Cantones vigentes");
  const alcanceOriginalIndicador = provinciasRows.find((p) => p.INDICADOR === "Alcance original");

  const resumen = {
    cantonesVisitados: cantonesValidosVisitados.size,
    metaCantones: alcanceOriginalIndicador ? toNumberOrNull(alcanceOriginalIndicador.VALOR) : 221,
    cantonesVigentesCatalogo: cantonesVigentesIndicador ? toNumberOrNull(cantonesVigentesIndicador.VALOR) : 222,
    kilometros: Math.round(kmTotales * 100) / 100,
    metaKilometros: 2210,
    vo2max: ultimoValor("vo2max"),
    recuperacion: ultimoValor("recuperacion"),
    pasos: pasosCount > 0 ? Math.round(pasosSuma / pasosCount) : null,
    caloriasPromedio: caloriasCount > 0 ? Math.round(caloriasSuma / caloriasCount) : null,
    ultimaActualizacion: new Date().toISOString(),
  };

  // --- carreras.json + rutas/<route_id>.geojson ---
  // El paquete se construye entero en un temporal hermano y solo sustituye al
  // anterior cuando esta completo y validado. Nunca se borra el destino "para
  // luego copiar": si algo falla a mitad, el paquete anterior sigue intacto.
  const SALIDA = crearTemporal(PAQUETE_DIR, "nuevo");
  await fsp.mkdir(path.join(SALIDA, "rutas"), { recursive: true });

  const carreras = [];
  for (const c of carrerasPublicables) {
    const ruta = rutasRows.find((r) => r.route_id === c.route_id) || null;
    const territorio = ruta ? territorioByCantonId.get(ruta.canton_id) : null;

    let rutaGeojsonRelPath = null;
    if (ruta && ruta.geojson_onedrive_path) {
      // geojson_onedrive_path viene como "RUMBO/..." (relativo al contenedor de
      // RUMBO_ROOT), igual que ubicacion_bitacora. Se resuelve con el mismo criterio.
      const srcGeojsonReal = resolveRumboAsset(ruta.geojson_onedrive_path);
      if (fs.existsSync(srcGeojsonReal)) {
        const destName = `${ruta.route_id}.geojson`;
        await fsp.copyFile(srcGeojsonReal, path.join(SALIDA, "rutas", destName));
        rutaGeojsonRelPath = `rutas/${destName}`;
      } else {
        warn(`GeoJSON de ruta no encontrado en disco: ${srcGeojsonReal} (route_id ${ruta.route_id})`);
      }
    }

    // Coordenadas fuera de Ecuador (validacion obligatoria)
    if (ruta) {
      const lat = toNumberOrNull(ruta.inicio_lat);
      const lon = toNumberOrNull(ruta.inicio_lng);
      if (lat !== null && lon !== null && !inEcuador(lat, lon)) {
        err(`Coordenadas fuera de Ecuador para route_id ${ruta.route_id}: lat=${lat}, lon=${lon}`);
      }
    }

    const galeria = relacionesRows
      .filter((rel) => rel.destination_type === "race" && rel.destination_id === c.race_id && esFotografiaAsset(rel))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((rel) => rel.asset_id);

    carreras.push({
      id: c.race_id,
      slug: c.slug,
      titulo: c.titulo,
      descripcionCorta: c.descripcion_corta ?? null,
      descripcionCompleta: c.descripcion_completa ?? null,
      fecha: c.fecha,
      fechaJornada: ruta ? ruta.fecha_jornada : null,
      fechaPublica: ruta ? ruta.fecha_publica : c.fecha,
      provincia: territorio ? territorio.provincia : null,
      canton: territorio ? territorio.canton_municipio : null,
      lugar: ruta ? ruta.lugar : null,
      distanciaKm: ruta ? toNumberOrNull(ruta.distancia_km) : null,
      duracionSeg: ruta ? toNumberOrNull(ruta.duracion_segundos) : null,
      desnivelM: ruta ? toNumberOrNull(ruta.desnivel_positivo_m) : null,
      caloriasKcal: ruta ? toNumberOrNull(ruta.calorias_kcal) : null,
      pasos: ruta ? toNumberOrNull(ruta.pasos_totales) : null,
      pasosFuente: ruta ? (ruta.pasos_fuente ?? null) : null,
      pasosConfianza: ruta ? (ruta.pasos_confianza ?? null) : null,
      deporte: ruta ? ruta.sport_label : null,
      deporteConfianza: ruta ? ruta.sport_confidence : null,
      subdeporte: ruta ? ruta.subsport_label : null,
      ubicacionFuente: ruta ? ruta.location_source : null,
      ubicacionConfianza: ruta ? ruta.location_confidence : null,
      imagenPrincipal: c.cover_photo_id || null,
      galeria,
      rutaGeojson: rutaGeojsonRelPath,
      estado: c.status,
    });
  }

  // --- cantones.json + cantones_visitados.geojson ---
  const carrerasPorCanton = new Map();
  for (const c of carreras) {
    const ruta = rutasRows.find((r) => r.route_id === (carrerasRows.find((cr) => cr.race_id === c.id) || {}).route_id);
    if (!ruta || !ruta.canton_id) continue;
    if (!carrerasPorCanton.has(ruta.canton_id)) carrerasPorCanton.set(ruta.canton_id, []);
    carrerasPorCanton.get(ruta.canton_id).push({ carrera: c, ruta });
  }

  const cantones = territorioRows.map((t) => {
    const entradas = carrerasPorCanton.get(t.territory_id) || [];
    const km = entradas.reduce((sum, e) => sum + (toNumberOrNull(e.ruta.distancia_km) || 0), 0);
    const fechas = entradas.map((e) => e.carrera.fecha).filter(Boolean).sort();
    return {
      cantonId: t.territory_id,
      provincia: t.provincia,
      canton: t.canton_municipio,
      visitado: entradas.length > 0,
      numCarreras: entradas.length,
      kmAcumulados: Math.round(km * 100) / 100,
      fechaUltimaCarrera: fechas.length ? fechas[fechas.length - 1] : null,
      carrerasIds: entradas.map((e) => e.carrera.id),
    };
  });

  const features = [];
  for (const [cantonId, entradas] of carrerasPorCanton.entries()) {
    let punto = null;
    for (const { ruta } of entradas) {
      if (!ruta.geojson_onedrive_path) continue;
      const srcGeojsonReal = resolveRumboAsset(ruta.geojson_onedrive_path);
      if (fs.existsSync(srcGeojsonReal)) {
        try {
          const geo = JSON.parse(fs.readFileSync(srcGeojsonReal, "utf-8"));
          const coords = geo?.features?.[0]?.geometry?.coordinates;
          punto = centroidOfLineString(coords);
        } catch {
          warn(`No se pudo leer/parsear el GeoJSON para calcular centroide: ${srcGeojsonReal}`);
        }
      }
      if (punto) break;
      // Fallback: primer punto GPS valido de la ruta (inicio_lat/inicio_lng)
      const lat = toNumberOrNull(ruta.inicio_lat);
      const lon = toNumberOrNull(ruta.inicio_lng);
      if (lat !== null && lon !== null) punto = [lon, lat];
    }
    if (!punto) {
      warn(`No se pudo calcular un punto representativo para el canton ${cantonId} (sin GeoJSON ni coordenadas)`);
      continue;
    }
    const t = territorioByCantonId.get(cantonId);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: punto },
      properties: {
        cantonId,
        provincia: t?.provincia ?? null,
        canton: t?.canton_municipio ?? null,
        numCarreras: entradas.length,
      },
    });
  }
  const cantonesVisitadosGeojson = { type: "FeatureCollection", features };

  // --- historias.json (solo aprobada_fidel / publicada) ---
  const historias = historiasRows
    .filter(esHistoriaPublicable)
    .map((h) => {
      const media = relacionesRows
        .filter((rel) => rel.destination_type === "story" && rel.destination_id === h.story_id)
        .map((rel) => rel.asset_id);
      return {
        id: h.story_id,
        slug: h.slug,
        tipo: h.tipo,
        titulo: h.titulo,
        extracto: h.resumen ?? null,
        fraseDestacada: h.frase_destacada ?? null,
        contenidoCompleto: h.contenido_completo ?? null,
        fecha: h.fecha,
        lugar: null,
        imagen: h.cover_photo_id || null,
        medios: media,
        estadoEditorial: h.status,
      };
    });
  for (const h of historiasRows) {
    if (h.status && !["propuesta_cowork", "pendiente_revision", "aprobada_fidel", "rechazada", "publicada"].includes(h.status)) {
      err(`Historia ${h.story_id} tiene un status fuera del catalogo: ${h.status}`);
    }
  }

  // --- medios.json / bitacora.json ---
  // Condicion EXPLICITA de publicacion: un medio solo puede copiarse a public/
  // si esta publicado (status=published), con derechos confirmados y una
  // licencia valida (no vacia ni "pendiente"/"null"). Nunca se asume que por
  // haberlo cargado Fidel un archivo puede hacerse publico.
  const licenciaValida = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return s !== "" && s !== "pendiente" && s !== "null";
  };
  const derechosConfirmados = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "sí" || s === "si";
  };
  const aprobadoParaPublicar = (m) =>
    m.status === "published" &&
    derechosConfirmados(m.derechos_confirmados) &&
    licenciaValida(m.licencia);

  // Segunda condicion, del mismo criterio compartido: un medio aprobado cuya
  // jornada no es publicable tampoco se publica. Sin esto, retirar una jornada
  // del sitio dejaba sus fotografias y videos accesibles por URL, enlazados o
  // no. Un medio sin jornada queda fuera por omision y con aviso nominal: los
  // medios generales, si algun dia existen, necesitaran una decision explicita.
  const jornadaPublicableDelMedio = (m) => {
    const j = jornadaDeMedio.get(m.media_id);
    if (!j) return { ok: false, motivo: "no tiene jornada_id en 17_BITACORA_ARCHIVOS" };
    if (!jornadasVisibles.has(j)) return { ok: false, motivo: `su jornada ${j} no es publicable` };
    return { ok: true, motivo: null };
  };

  const mediosAutorizados = [];
  for (const m of mediosRows) {
    if (!aprobadoParaPublicar(m)) {
      if (m.status === "published") {
        warn(
          `Medio ${m.media_id} publicado pero SIN aprobacion para public/ (falta derechos_confirmados=Si o licencia valida); no se copia.`
        );
      }
      continue;
    }
    const jornada = jornadaPublicableDelMedio(m);
    if (!jornada.ok) {
      warn(`Medio ${m.media_id} excluido: ${jornada.motivo}; no se copia.`);
      continue;
    }
    mediosAutorizados.push(m);
  }
  // Mapa bitacora_id -> ruta web del medio APROBADO derivado de ese original,
  // para que la Bitacora enlace solo medios aprobados (nunca el original).
  const aprobadoPorBitacoraId = new Map();
  const medios = [];
  await fsp.mkdir(path.join(SALIDA, "archivos", "imagenes"), { recursive: true });
  await fsp.mkdir(path.join(SALIDA, "archivos", "audios"), { recursive: true });
  await fsp.mkdir(path.join(SALIDA, "archivos", "videos"), { recursive: true });

  const tipoToCarpeta = { fotografia: "imagenes", audio: "audios", video: "videos" };

  for (const m of mediosAutorizados) {
    const carpeta = tipoToCarpeta[m.tipo_medio] || "imagenes";
    const bitacoraOrigen = bitacoraArchivosRows.find((b) => b.bitacora_id === m.bitacora_id);
    const nombreOriginal = bitacoraOrigen?.nombre_original || m.archivo_nombre;
    const rutaOrigenRel = bitacoraOrigen?.ubicacion_bitacora;
    let webPath = null;
    if (rutaOrigenRel) {
      const srcReal = resolveRumboAsset(rutaOrigenRel);
      if (fs.existsSync(srcReal)) {
        const destName = safeMediaName(m.media_id, nombreOriginal);
        await fsp.copyFile(srcReal, path.join(SALIDA, "archivos", carpeta, destName));
        webPath = `archivos/${carpeta}/${destName}`;
      } else {
        warn(`Medio autorizado pero archivo no encontrado en disco, no se copia: ${m.media_id} (${srcReal})`);
      }
    } else {
      warn(`Medio ${m.media_id} sin bitacora_id/ubicacion resuelta, no se copia`);
    }

    if (webPath && m.bitacora_id) aprobadoPorBitacoraId.set(m.bitacora_id, webPath);

    // Derivado compatible con Instagram Foto (solo fotografias). Nunca toca el
    // original: crea "<base>__instagram.jpg" en la misma carpeta imagenes/.
    // Idempotente. Si no puede generarse, se marca error y no se enlaza (para
    // que preparar-publicacion-redes.mjs bloquee esa foto en Instagram).
    let instagram = null;
    if (webPath && m.tipo_medio === "fotografia") {
      const w = toNumberOrNull(bitacoraOrigen?.ancho_pixeles);
      const h = toNumberOrNull(bitacoraOrigen?.alto_pixeles);
      const srcRealImg = rutaOrigenRel ? resolveRumboAsset(rutaOrigenRel) : null;
      const destNameIg = safeMediaName(m.media_id, nombreOriginal);
      if (w && h && necesitaDerivadoInstagram(w, h) && srcRealImg && fs.existsSync(srcRealImg)) {
        const res = await generarDerivadoInstagram({
          srcPath: srcRealImg,
          w,
          h,
          destDir: path.join(SALIDA, "archivos", carpeta),
          nombreArchivo: destNameIg,
        });
        if (res.ok) {
          instagram = {
            requiereDerivado: true,
            rutaWebInstagram: `archivos/${carpeta}/${res.nombre}`,
            anchoOriginal: w,
            altoOriginal: h,
            ratioOriginal: res.ratioOriginal,
            anchoDerivado: res.outW,
            altoDerivado: res.outH,
            ratioFinal: res.ratioFinal,
          };
        } else {
          instagram = {
            requiereDerivado: true,
            error: res.error,
            rutaWebInstagram: null,
            anchoOriginal: w,
            altoOriginal: h,
            ratioOriginal: ratioDe(w, h),
          };
          warn(
            `No se pudo generar el derivado Instagram de ${m.media_id}: ${res.error}. No debe publicarse en Instagram.`
          );
        }
      } else if (w && h) {
        instagram = {
          requiereDerivado: false,
          rutaWebInstagram: webPath,
          anchoOriginal: w,
          altoOriginal: h,
          ratioOriginal: ratioDe(w, h),
        };
      }
    }

    medios.push({
      mediaId: m.media_id,
      tipo: m.tipo_medio,
      titulo: m.titulo,
      descripcion: m.descripcion,
      rutaWeb: webPath,
      instagram,
      credito: bitacoraOrigen?.autor || null,
      fuente: m.location_source,
      licencia: null,
      estado: m.status,
    });
  }

  // --- bitacora.json: fuente de verdad = 17_BITACORA_ARCHIVOS ---
  // Incluye TODO original de Fidel sin ningun filtro editorial (aprobacion de
  // Carrera/Historia, publicacion, estado publico). Los derivados de
  // 19_ARCHIVOS_DERIVADOS se enlazan por origen, pero nunca cuentan como
  // originales nuevos.
  const TIPO_A_CATEGORIA = {
    fotografia: "fotografias",
    nota: "documentos",
    documento: "documentos",
    audio: "audios",
    video: "videos",
    actividad: "rutas",
  };
  const categoriaDe = (tipoArchivo) => TIPO_A_CATEGORIA[String(tipoArchivo || "").toLowerCase()] || "otros";

  const derivadosPorOrigen = new Map();
  for (const d of archivosDerivadosRows) {
    if (!d.source_bitacora_id) continue;
    if (!derivadosPorOrigen.has(d.source_bitacora_id)) derivadosPorOrigen.set(d.source_bitacora_id, []);
    derivadosPorOrigen.get(d.source_bitacora_id).push({
      tipo: d.derived_type,
      nombre: d.derived_file_name,
      generadoPor: d.generated_by,
    });
  }

  // NO se crea "archivos/originales": los originales nunca se publican.

  // Criterio relacional: la Bitacora publica solo muestra originales de
  // jornadas con Carrera o Historia publicable (mismo conjunto jornadasVisibles
  // que filtra los medios). Sin esto, retirar una jornada del sitio dejaba sus
  // originales listados.
  const bitacoraIds = new Set();
  const bitacoraItems = [];
  for (const b of bitacoraArchivosRows) {
    if (bitacoraIds.has(b.bitacora_id)) err(`bitacora_id duplicado: ${b.bitacora_id}`);
    bitacoraIds.add(b.bitacora_id);

    if (!b.jornada_id) {
      warn(`Bitacora ${b.bitacora_id} excluida: no tiene jornada_id.`);
      continue;
    }
    if (!jornadasVisibles.has(b.jornada_id)) {
      warn(`Bitacora ${b.bitacora_id} excluida: su jornada ${b.jornada_id} no es publicable.`);
      continue;
    }

    const territorio = b.canton_id ? territorioByCantonId.get(b.canton_id) : null;
    const categoria = categoriaDe(b.tipo_archivo);

    // Si este original es una actividad de ruta (FIT/GPX/TCX), resolver su
    // GeoJSON via 06_RUTAS (misma logica y mismo archivo de destino que usa
    // el bloque de carreras.json, para no duplicar la copia).
    let rutaGeojsonRelPath = null;
    if (categoria === "rutas") {
      const rutaAsociada = rutasRows.find((r) => r.source_route_bitacora_id === b.bitacora_id);
      if (rutaAsociada && rutaAsociada.geojson_onedrive_path) {
        const srcGeojsonReal = resolveRumboAsset(rutaAsociada.geojson_onedrive_path);
        if (fs.existsSync(srcGeojsonReal)) {
          const destName = `${rutaAsociada.route_id}.geojson`;
          await fsp.copyFile(srcGeojsonReal, path.join(SALIDA, "rutas", destName));
          rutaGeojsonRelPath = `rutas/${destName}`;
        }
      }
    }

    // Regla de privacidad: los ORIGINALES nunca se publican en public/. La
    // Bitacora enlaza unicamente el medio ya APROBADO para publicacion derivado
    // de este original (published + derechos_confirmados + licencia valida). Si
    // no hay medio aprobado, la Bitacora no expone ningun archivo (rutaWeb null).
    const webPath = aprobadoPorBitacoraId.get(b.bitacora_id) || null;

    bitacoraItems.push({
      id: b.bitacora_id,
      jornadaId: b.jornada_id,
      categoria,
      tipoArchivo: b.tipo_archivo,
      nombre: b.nombre_original,
      titulo: b.titulo_publico || b.nombre_original,
      descripcion: b.descripcion_publica || null,
      fechaIngreso: b.fecha_hora_llegada || null,
      fechaCaptura: b.fecha_hora_captura || null,
      fechaPublica: b.fecha_publica || null,
      provincia: territorio ? territorio.provincia : null,
      canton: territorio ? territorio.canton_municipio : null,
      lugar: b.lugar_publico || null,
      rutaWeb: webPath,
      rutaGeojson: rutaGeojsonRelPath,
      duracionSegundos: toNumberOrNull(b.duracion_segundos),
      anchoPixeles: toNumberOrNull(b.ancho_pixeles),
      altoPixeles: toNumberOrNull(b.alto_pixeles),
      hash: b.hash_copia_sha256 || null,
      origen: b.fuente || null,
      tipoOrigen: b.tipo_origen || null,
      estadoIngesta: b.estado_ingesta || null,
      publicStatus: b.public_status || null,
      derivados: derivadosPorOrigen.get(b.bitacora_id) || [],
    });
  }

  const bitacoraPorCategoria = {};
  for (const it of bitacoraItems) {
    bitacoraPorCategoria[it.categoria] = (bitacoraPorCategoria[it.categoria] || 0) + 1;
  }

  const bitacora = { items: bitacoraItems };

  // --- manifest.json ---
  const manifest = {
    generadoEn: new Date().toISOString(),
    fuenteExcel: xlsxFiles[0],
    hashExcel: excelHash,
    scriptVersion: "1.0.0",
    conteos: {
      jornadas: jornadas.length,
      carreras: carreras.length,
      historias: historias.length,
      medios: medios.length,
      cantonesVisitados: resumen.cantonesVisitados,
      bitacoraOriginales: bitacoraItems.length,
      bitacoraPorCategoria,
    },
    advertencias: warnings,
    errores: errors,
  };

  // --- Escribir todo (en el temporal) ---
  await fsp.mkdir(SALIDA, { recursive: true });
  const writeJson = (name, data) =>
    fsp.writeFile(path.join(SALIDA, name), JSON.stringify(data, null, 2), "utf-8");

  await writeJson("resumen.json", resumen);
  await writeJson("cantones.json", { cantones });
  await writeJson("cantones_visitados.geojson", cantonesVisitadosGeojson);
  await writeJson("carreras.json", { carreras });
  await writeJson("historias.json", { historias });
  await writeJson("bitacora.json", bitacora);
  await writeJson("medios.json", { medios });
  await writeJson("manifest.json", manifest);

  // --- Validar el temporal ANTES de que sustituya al paquete anterior ---
  const problemas = validarDirectorio(SALIDA, {
    obligatorios: JSON_FILES,
    extensiones: [
      ".json", ".geojson",
      ".jpg", ".jpeg", ".png", ".webp",
      ".wav", ".mp3", ".m4a",
      ".mp4", ".mov",
    ],
    comprobaciones: (porRuta) => {
      const malos = [];
      // El manifiesto debe ser JSON valido y con los conteos que corresponden.
      let man;
      try {
        man = JSON.parse(fs.readFileSync(path.join(SALIDA, "manifest.json"), "utf-8"));
      } catch (e) {
        return [`manifest.json no es JSON valido: ${e.message}`];
      }
      if (man.conteos?.carreras !== carreras.length) malos.push("manifest.conteos.carreras no coincide");
      if (man.conteos?.historias !== historias.length) malos.push("manifest.conteos.historias no coincide");
      if (man.conteos?.medios !== medios.length) malos.push("manifest.conteos.medios no coincide");
      // Los ocho JSON deben parsear.
      for (const f of JSON_FILES) {
        try {
          JSON.parse(fs.readFileSync(path.join(SALIDA, f), "utf-8"));
        } catch (e) {
          malos.push(`JSON invalido: ${f} (${e.message})`);
        }
      }
      // Toda referencia a un archivo debe existir dentro del temporal.
      const refs = [
        ...medios.map((m) => m.rutaWeb),
        ...medios.map((m) => m.instagram?.rutaWebInstagram),
        ...carreras.map((c) => c.rutaGeojson),
        ...bitacoraItems.map((b) => b.rutaWeb),
        ...bitacoraItems.map((b) => b.rutaGeojson),
      ].filter(Boolean);
      for (const ref of refs) {
        if (!porRuta.has(ref)) malos.push(`referencia a un archivo inexistente: ${ref}`);
      }
      return malos;
    },
  });

  if (problemas.length > 0) {
    for (const p of problemas) err(`Paquete no valido: ${p}`);
    await descartarTemporal(SALIDA);
    err("El paquete anterior se conserva intacto: no se sustituyo nada.");
    return;
  }

  // Un error de integridad detectado antes (identificadores duplicados,
  // referencias inexistentes, hoja ausente) tampoco debe llegar al paquete.
  if (errors.length > 0) {
    await descartarTemporal(SALIDA);
    err("Se encontraron errores: el paquete anterior se conserva intacto.");
    return;
  }

  // --- Sustituir el paquete anterior, ya validado ---
  try {
    await sustituir(PAQUETE_DIR, SALIDA, { onAviso: warn });
  } catch (e) {
    await descartarTemporal(SALIDA);
    err(`No se pudo sustituir el paquete: ${e.message}. El anterior sigue en su sitio.`);
    return;
  }

  console.log(`\nPaquete generado en: ${PAQUETE_DIR}`);
  console.log(`Carreras: ${carreras.length} | Historias: ${historias.length} | Medios: ${medios.length} | Cantones visitados: ${resumen.cantonesVisitados}`);
  console.log(`Advertencias: ${warnings.length} | Errores: ${errors.length}`);
}

// --- Fase 2: SINCRONIZAR paquete ya generado hacia public/data/rumbo ---

async function syncToPublic() {
  if (!fs.existsSync(PAQUETE_DIR)) {
    err(`No existe ${PAQUETE_DIR}. Ejecuta primero --generate.`);
    return;
  }
  for (const f of JSON_FILES) {
    const p = path.join(PAQUETE_DIR, f);
    if (!fs.existsSync(p)) {
      err(`Falta archivo requerido en el paquete: ${f}`);
      continue;
    }
    try {
      JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch (e) {
      err(`JSON invalido en ${f}: ${e.message}`);
    }
  }

  if (errors.length > 0) return;

  // Los dos destinos se construyen completos en un temporal hermano y solo
  // sustituyen al anterior cuando estan validados. Si algo falla, el sitio se
  // queda con los datos que ya tenia, nunca a medias ni vacio. Al sustituir el
  // directorio entero desaparece cualquier residuo de una version anterior.
  const extensionesPaquete = [
    ".json", ".geojson",
    ".jpg", ".jpeg", ".png", ".webp",
    ".wav", ".mp3", ".m4a",
    ".mp4", ".mov",
  ];

  // 1) public/data/rumbo
  const tmpPublic = crearTemporal(CODEBASE_PUBLIC_DIR, "nuevo");
  try {
    await fsp.cp(PAQUETE_DIR, tmpPublic, { recursive: true });
    const p = validarDirectorio(tmpPublic, {
      obligatorios: JSON_FILES,
      extensiones: extensionesPaquete,
    });
    if (p.length > 0) {
      for (const m of p) err(`Copia a public/ no valida: ${m}`);
      await descartarTemporal(tmpPublic);
      err("public/data/rumbo se conserva como estaba.");
      return;
    }
    await sustituir(CODEBASE_PUBLIC_DIR, tmpPublic, { onAviso: warn });
  } catch (e) {
    await descartarTemporal(tmpPublic);
    err(`No se pudo sincronizar public/data/rumbo: ${e.message}. Se conserva el contenido anterior.`);
    return;
  }

  // 2) espejo en src/, solo los ocho JSON
  const tmpEspejo = crearTemporal(CODEBASE_SRC_MIRROR_DIR, "nuevo");
  try {
    for (const f of JSON_FILES) {
      await fsp.copyFile(path.join(PAQUETE_DIR, f), path.join(tmpEspejo, f));
    }
    const p = validarDirectorio(tmpEspejo, {
      obligatorios: JSON_FILES,
      extensiones: [".json", ".geojson"],
    });
    if (p.length > 0) {
      for (const m of p) err(`Espejo no valido: ${m}`);
      await descartarTemporal(tmpEspejo);
      err("src/data/generated/rumbo-web se conserva como estaba.");
      return;
    }
    await sustituir(CODEBASE_SRC_MIRROR_DIR, tmpEspejo, { onAviso: warn });
  } catch (e) {
    await descartarTemporal(tmpEspejo);
    err(`No se pudo sincronizar el espejo: ${e.message}. Se conserva el contenido anterior.`);
    return;
  }

  console.log(`\nPaquete sincronizado hacia: ${CODEBASE_PUBLIC_DIR}`);
  console.log(`Espejo para import estatico en: ${CODEBASE_SRC_MIRROR_DIR}`);
  console.log(`Advertencias: ${warnings.length} | Errores: ${errors.length}`);
}

// --- CLI ---

async function main() {
  const args = process.argv.slice(2);
  const onlyGenerate = args.includes("--generate");
  const onlySync = args.includes("--sync");

  if (onlySync) {
    await syncToPublic();
  } else if (onlyGenerate) {
    await generatePackage();
  } else {
    await generatePackage();
    await syncToPublic();
  }

  if (errors.length > 0) {
    console.error(`\nFinalizado con ${errors.length} error(es). No se debe considerar valido para publicar.`);
    process.exitCode = 1;
  } else {
    console.log("\nFinalizado sin errores.");
  }
}

main().catch((e) => {
  console.error("Fallo inesperado en sync-rumbo:", e);
  process.exitCode = 1;
});
