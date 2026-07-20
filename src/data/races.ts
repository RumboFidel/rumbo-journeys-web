import type { ContentStatus, Race } from "./types";
import { CARRERAS_WEB } from "./rumbo-web";

// Adaptador de compatibilidad: expone las Carreras reales (generadas desde el
// Excel via rumbo-web.ts) con la forma minima que usan los enlaces de
// relaciones de la Bitacora. Las paginas principales de Carreras deben usar
// repo.carreras (CarreraWeb), no este adaptador.
function mapEstado(estado: string | null): ContentStatus {
  if (estado === "draft" || estado === "under_review" || estado === "approved" || estado === "published" || estado === "hidden") {
    return estado;
  }
  return "draft";
}

export const RACES: Race[] = CARRERAS_WEB.map((c) => ({
  id: c.id,
  slug: c.slug,
  title: c.titulo,
  routeId: c.rutaGeojson ? c.id : undefined,
  locationId: undefined,
  date: c.fecha ?? undefined,
  status: mapEstado(c.estado),
}));

export function getRaceById(id: string): Race | undefined {
  return RACES.find((r) => r.id === id);
}
