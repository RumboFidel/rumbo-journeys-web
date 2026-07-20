// Capa de acceso a datos (repositorio local). Todo consumidor debe importar
// desde aquí, no desde los archivos mock individuales. Cuando se conecte
// Supabase / Excel se reescribe este módulo sin tocar componentes.

import type {
  AssetType,
  Audio,
  ContentRelation,
  DestinationType,
  GpxRoute,
  Medal,
  NotebookDocument,
  Photograph,
  Race,
  Story,
  Video,
} from "./types";
import { PHOTOGRAPHS } from "./photographs";
import { AUDIOS } from "./audios";
import { VIDEOS } from "./videos";
import { NOTEBOOKS_DOCUMENTS } from "./notebooks-documents";
import { GPX_ROUTES } from "./gpx-routes";
import { MEDALS } from "./medals";
import { RACES, getRaceById } from "./races";
import { STORIES, getStoryById } from "./stories";
import { CONTENT_RELATIONS } from "./content-relations";
import { getLocationById, locationLabel, LOCATIONS } from "./locations";

const published = <T extends { status: string }>(rows: T[]) =>
  rows.filter((r) => r.status === "published");

export const repo = {
  photographs: {
    all: (): Photograph[] => published(PHOTOGRAPHS),
    bySlug: (slug: string) => PHOTOGRAPHS.find((p) => p.slug === slug && p.status === "published"),
  },
  audios: {
    all: (): Audio[] => published(AUDIOS),
    bySlug: (slug: string) => AUDIOS.find((a) => a.slug === slug && a.status === "published"),
  },
  videos: {
    all: (): Video[] => published(VIDEOS),
    bySlug: (slug: string) => VIDEOS.find((v) => v.slug === slug && v.status === "published"),
  },
  notebooksDocuments: {
    all: (): NotebookDocument[] => published(NOTEBOOKS_DOCUMENTS),
    bySlug: (slug: string) =>
      NOTEBOOKS_DOCUMENTS.find((n) => n.slug === slug && n.status === "published"),
  },
  gpxRoutes: {
    all: (): GpxRoute[] => published(GPX_ROUTES),
    bySlug: (slug: string) => GPX_ROUTES.find((g) => g.slug === slug && g.status === "published"),
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
};

// Contadores automáticos de tarjetas de Bitácora.
export function bitacoraCounts() {
  return {
    photographs: repo.photographs.all().length,
    notebooksDocuments: repo.notebooksDocuments.all().length,
    audios: repo.audios.all().length,
    videos: repo.videos.all().length,
    gpxRoutes: repo.gpxRoutes.all().length,
    medals: repo.medals.all().length,
  };
}
