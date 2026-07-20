import type { Location } from "./types";

// Datos mock. Reemplazables por la colección "Lugares" del Excel/Supabase.
export const LOCATIONS: Location[] = [
  {
    id: "loc-quito-centro",
    country: "Ecuador",
    province: "Pichincha",
    canton: "Quito",
    parishOrLocality: "Centro Histórico",
    visibleName: "Centro Histórico de Quito",
    latitude: -0.2201,
    longitude: -78.5123,
    altitude: 2850,
    gpsAccuracy: 5,
  },
  {
    id: "loc-cotopaxi-refugio",
    country: "Ecuador",
    province: "Cotopaxi",
    canton: "Latacunga",
    parishOrLocality: "Parque Nacional Cotopaxi",
    visibleName: "Refugio José Rivas — Cotopaxi",
    latitude: -0.6598,
    longitude: -78.4361,
    altitude: 4864,
    gpsAccuracy: 8,
  },
  {
    id: "loc-cuenca-tomebamba",
    country: "Ecuador",
    province: "Azuay",
    canton: "Cuenca",
    parishOrLocality: "Barranco del Tomebamba",
    visibleName: "Río Tomebamba, Cuenca",
    latitude: -2.9006,
    longitude: -79.0045,
    altitude: 2560,
    gpsAccuracy: 4,
  },
  {
    id: "loc-atacames-malecon",
    country: "Ecuador",
    province: "Esmeraldas",
    canton: "Atacames",
    parishOrLocality: "Malecón",
    visibleName: "Malecón de Atacames",
    latitude: 0.8624,
    longitude: -79.8442,
    altitude: 6,
    gpsAccuracy: 6,
  },
  {
    id: "loc-guayaquil-laspenas",
    country: "Ecuador",
    province: "Guayas",
    canton: "Guayaquil",
    parishOrLocality: "Cerro Santa Ana",
    visibleName: "Las Peñas, Guayaquil",
    latitude: -2.1894,
    longitude: -79.8756,
    altitude: 30,
    gpsAccuracy: 5,
  },
  {
    id: "loc-loja-catamayo",
    country: "Ecuador",
    province: "Loja",
    canton: "Catamayo",
    visibleName: "Valle de Catamayo",
    latitude: -3.9847,
    longitude: -79.3577,
    altitude: 1230,
    gpsAccuracy: 7,
  },
];

export function getLocationById(id?: string): Location | undefined {
  if (!id) return undefined;
  return LOCATIONS.find((l) => l.id === id);
}

export function locationLabel(id?: string): string {
  const l = getLocationById(id);
  if (!l) return "";
  return `${l.canton}, ${l.province}`;
}
