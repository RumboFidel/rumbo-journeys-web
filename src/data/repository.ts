// Capa de acceso a datos (repositorio local). Todo consumidor debe importar
// desde aquí, no desde los archivos mock individuales. Cuando se conecte
// Supabase / Excel se reescribe este módulo sin tocar componentes.

import type {
  AssetType,
  BitacoraCategoria,
  BitacoraItemWeb,
  CantonWeb,
  CarreraWeb,
  ContentRelation,
  DestinationType,
  HistoriaWeb,
  Medal,
  MedioWeb,
  Race,
  ResumenWeb,
  Story,
} from "./types";
import { MEDALS } from "./medals";
import { RACES, getRaceById } from "./races";
import { STORIES, getStoryById } from "./stories";
import { CONTENT_RELATIONS } from "./content-relations";
import { getLocationById, locationLabel, LOCATIONS } from "./locations";
import { BITACORA_WEB, CANTONES_WEB, CARRERAS_WEB, HISTORIAS_WEB, MEDIOS_WEB, RESUMEN_WEB } from "./rumbo-web";

const published = <T extends { status: string }>(rows: T[]) =>
  rows.filter((r) => r.status === "published");

// Las rutas de archivo del paquete web (rutaWeb, rutaGeojson) vienen del
// generador como relativas al paquete (ej. "archivos/imagenes/x.jpg"). El
// paquete se sirve en /data/rumbo/, así que hay que anteponer ese prefijo
// antes de usarlas como src/href/fetch en el navegador; de lo contrario el
// navegador las resuelve relativas a la URL de la página actual y fallan.
const RUMBO_WEB_BASE = "/data/rumbo/";
function webAssetUrl<T extends string | null | undefined>(relPath: T): T {
  if (!relPath) return relPath;
  if (/^(https?:)?\//.test(relPath)) return relPath;
  return (RUMBO_WEB_BASE + relPath) as T;
}

export const repo = {
  // Bitacora privada: fuente de verdad = 17_BITACORA_ARCHIVOS (via bitacora.json).
  // Incluye TODO original de Fidel, sin filtro editorial. "id" hace de slug
  // (17_BITACORA_ARCHIVOS no tiene un campo de slug propio).
  bitacora: {
    all: (): BitacoraItemWeb[] =>
      BITACORA_WEB.map((b) => ({
        ...b,
        rutaWeb: webAssetUrl(b.rutaWeb),
        rutaGeojson: webAssetUrl(b.rutaGeojson),
      })),
    byCategoria: (categoria: BitacoraCategoria): BitacoraItemWeb[] =>
      repo.bitacora.all().filter((b) => b.categoria === categoria),
    byId: (id: string) => repo.bitacora.all().find((b) => b.id === id),
  },
  medals: {
    all: (): Medal[] => published(MEDALS),
    bySlug: (slug: string) => MEDALS.find((m) => m.slug === slug && m.status === "published"),
  },
  races: {
    all: (): Race[] => published(RACES),
    byId: getRaceById,
  },
  stories: {
    all: (): Story[] => published(STORIES),
    byId: getStoryById,
  },
  locations: {
    all: () => LOCATIONS,
    byId: getLocationById,
    label: locationLabel,
  },
  relations: {
    all: (): ContentRelation[] => CONTENT_RELATIONS,
    forAsset: (assetType: AssetType, assetId: string) =>
      CONTENT_RELATIONS.filter((r) => r.assetType === assetType && r.assetId === assetId),
    forDestination: (destinationType: DestinationType, destinationId: string) =>
      CONTENT_RELATIONS.filter(
        (r) => r.destinationType === destinationType && r.destinationId === destinationId
      ),
  },
  // Capa unica de datos generada desde el Excel maestro (ver rumbo-web.ts).
  // Home, Carreras, Historias y el mapa deben consumir unicamente esto.
  carreras: {
    all: (): CarreraWeb[] => CARRERAS_WEB.map((c) => ({ ...c, rutaGeojson: webAssetUrl(c.rutaGeojson) })),
    bySlug: (slug: string) => {
      const c = CARRERAS_WEB.find((c) => c.slug === slug);
      return c ? { ...c, rutaGeojson: webAssetUrl(c.rutaGeojson) } : undefined;
    },
  },
  historias: {
    // historias.json ya viene filtrado por sync-rumbo.mjs a solo
    // aprobada_fidel/publicada; no se re-filtra aqui para no duplicar la regla.
    all: (): HistoriaWeb[] => HISTORIAS_WEB,
    bySlug: (slug: string) => HISTORIAS_WEB.find((h) => h.slug === slug),
  },
  cantones: {
    all: (): CantonWeb[] => CANTONES_WEB,
    byId: (id: string) => CANTONES_WEB.find((c) => c.cantonId === id),
  },
  resumen: {
    get: (): ResumenWeb => RESUMEN_WEB,
  },
  medios: {
    all: (): MedioWeb[] => MEDIOS_WEB.map((m) => ({ ...m, rutaWeb: webAssetUrl(m.rutaWeb) })),
    byId: (id?: string | null) => {
      const m = id ? MEDIOS_WEB.find((m) => m.mediaId === id) : undefined;
      return m ? { ...m, rutaWeb: webAssetUrl(m.rutaWeb) } : undefined;
    },
  },
};

// Contadores automáticos de tarjetas de Bitácora, calculados desde
// bitacora.json (17_BITACORA_ARCHIVOS). Nunca hardcodeados.
export function bitacoraCounts() {
  const all = repo.bitacora.all();
  const count = (cat: BitacoraCategoria) => all.filter((b) => b.categoria === cat).length;
  return {
    fotografias: count("fotografias"),
    documentos: count("documentos"),
    audios: count("audios"),
    videos: count("videos"),
    rutas: count("rutas"),
    medals: repo.medals.all().length,
  };
}
