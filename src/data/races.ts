import type { Race } from "./types";

// Referencias mínimas a Carreras para relacionar contenidos. La vista
// pública de Carreras conserva su propia data; esto sólo mapea ids/slugs.
export const RACES: Race[] = [
  { id: "race-guayaquil", slug: "guayaquil", title: "Guayaquil", locationId: "loc-guayaquil-laspenas", routeId: "gpx-guayaquil", date: "2026-06-12", status: "published" },
  { id: "race-cotopaxi", slug: "cotopaxi", title: "Cotopaxi", locationId: "loc-cotopaxi-refugio", routeId: "gpx-cotopaxi", date: "2026-05-14", status: "published" },
  { id: "race-cuenca", slug: "cuenca", title: "Cuenca", locationId: "loc-cuenca-tomebamba", routeId: "gpx-cuenca", date: "2026-04-22", status: "published" },
  { id: "race-atacames", slug: "atacames", title: "Atacames", locationId: "loc-atacames-malecon", routeId: "gpx-atacames", date: "2026-06-30", status: "published" },
];

export function getRaceById(id: string): Race | undefined {
  return RACES.find((r) => r.id === id);
}
