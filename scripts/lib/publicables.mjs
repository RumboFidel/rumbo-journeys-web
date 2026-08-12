// scripts/lib/publicables.mjs
//
// Criterio UNICO de que puede llegar al paquete web. Antes cada seccion de
// sync-rumbo.mjs aplicaba una condicion distinta —o ninguna—, de modo que el
// estado editorial del Excel no gobernaba realmente el sitio: carreras.json,
// los kilometros, los cantones y la bitacora se construian sin mirar el status.
//
// Todo consumidor debe importar de aqui. No duplicar estas listas.

/** Una Carrera llega al paquete web solo con estos estados. */
export const CARRERA_PUBLICABLE = ["confirmada", "publicada"];

/**
 * Una Historia llega al paquete web solo con estos estados
 * (catalogo historia_status de 12_CATALOGOS).
 */
export const HISTORIA_PUBLICABLE = ["aprobada_fidel", "publicada"];

function normaliza(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function esCarreraPublicable(carrera) {
  return CARRERA_PUBLICABLE.includes(normaliza(carrera && carrera.status));
}

export function esHistoriaPublicable(historia) {
  return HISTORIA_PUBLICABLE.includes(normaliza(historia && historia.status));
}

/**
 * Conjunto de jornada_id que pueden aparecer en la Bitacora publica.
 *
 * Es la union de las jornadas asociadas a una Carrera publicable y las
 * asociadas a una Historia publicable. Ni 03_CARRERAS ni 04_HISTORIAS tienen
 * columna jornada_id, asi que el vinculo se resuelve por relacion:
 *
 *   Carrera  -> 02_JORNADAS.race_id
 *            -> (respaldo) 06_RUTAS.source_route_bitacora_id -> 17.jornada_id
 *   Historia -> 04_HISTORIAS.source_material_ids -> media_id -> 17.jornada_id
 *            -> (respaldo) 08_RELACIONES (media -> story) -> media_id -> 17
 *
 * Devuelve { jornadas: Set<string>, motivos: Map<jornada_id, string[]> } para
 * poder explicar por que una jornada quedo dentro.
 */
export function jornadasPublicables({
  carrerasRows = [],
  historiasRows = [],
  jornadasRows = [],
  rutasRows = [],
  bitacoraRows = [],
  relacionesRows = [],
} = {}) {
  const jornadas = new Set();
  const motivos = new Map();

  const anota = (jornadaId, motivo) => {
    if (!jornadaId) return;
    jornadas.add(jornadaId);
    if (!motivos.has(jornadaId)) motivos.set(jornadaId, []);
    if (!motivos.get(jornadaId).includes(motivo)) motivos.get(jornadaId).push(motivo);
  };

  // media_id -> jornada_id, y bitacora_id -> jornada_id (17_BITACORA_ARCHIVOS)
  const jornadaPorMedia = new Map();
  const jornadaPorBitacora = new Map();
  for (const b of bitacoraRows) {
    if (b.media_id && b.jornada_id) jornadaPorMedia.set(b.media_id, b.jornada_id);
    if (b.bitacora_id && b.jornada_id) jornadaPorBitacora.set(b.bitacora_id, b.jornada_id);
  }

  // --- Carreras publicables ---
  for (const c of carrerasRows) {
    if (!esCarreraPublicable(c)) continue;
    const jornada = jornadasRows.find((j) => j.race_id === c.race_id);
    if (jornada && jornada.jornada_id) {
      anota(jornada.jornada_id, `carrera:${c.race_id}`);
      continue;
    }
    // Respaldo: la ruta de la carrera procede de un original de la bitacora.
    const ruta = rutasRows.find((r) => r.route_id === c.route_id);
    if (ruta && ruta.source_route_bitacora_id) {
      anota(jornadaPorBitacora.get(ruta.source_route_bitacora_id), `carrera:${c.race_id}`);
    }
  }

  // --- Historias publicables ---
  for (const h of historiasRows) {
    if (!esHistoriaPublicable(h)) continue;
    const ids = String(h.source_material_ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let encontrada = false;
    for (const id of ids) {
      const j = jornadaPorMedia.get(id);
      if (j) { anota(j, `historia:${h.story_id}`); encontrada = true; }
    }
    if (encontrada) continue;
    // Respaldo: relaciones media -> story.
    for (const rel of relacionesRows) {
      if (rel.destination_type !== "story" || rel.destination_id !== h.story_id) continue;
      if (rel.asset_type !== "media") continue;
      anota(jornadaPorMedia.get(rel.asset_id), `historia:${h.story_id}`);
    }
  }

  return { jornadas, motivos };
}
