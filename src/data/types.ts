// Capa central de tipos para Bitácora. Todo el contenido público se filtra por
// status === "published". La forma de estos tipos es la que consumirán los
// componentes visuales — cuando se conecte Supabase/Excel el repositorio en
// src/data/repository.ts se reemplaza sin tocar la UI.

export type ContentStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "published"
  | "hidden";

export type BaseAsset = {
  id: string;
  slug: string;
  captureDate?: string; // ISO
  publicationDate?: string; // ISO
  locationId?: string;
  description?: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  capturedAt?: string;
  synchronizedAt?: string;
  publishedAt?: string;
};

export type Location = {
  id: string;
  country: string;
  province: string;
  canton: string;
  parishOrLocality?: string;
  visibleName: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  gpsAccuracy?: number;
  notes?: string;
};

export type Photograph = BaseAsset & {
  title?: string;
  imageUrl: string;
  credit?: string;
};

export type Audio = BaseAsset & {
  title: string;
  audioUrl: string;
  durationSeconds: number;
  transcript?: string;
};

export type VideoType = "testimonial" | "interview" | "route" | "other";

export type Video = BaseAsset & {
  title: string;
  videoType: VideoType;
  coverUrl: string;
  videoUrl?: string;
  durationSeconds: number;
};

export type NotebookDocumentKind = "notebook" | "document";
export type NotebookDocumentFormat = "pdf" | "image" | "external";

export type NotebookDocument = BaseAsset & {
  title: string;
  kind: NotebookDocumentKind;
  format: NotebookDocumentFormat;
  fileUrl?: string;
  pageCount?: number;
  coverUrl?: string;
};

export type GpxRoute = BaseAsset & {
  title: string;
  raceId?: string;
  date: string;
  distanceKm: number;
  durationSeconds?: number;
  elevationGain?: number;
  elevationLoss?: number;
  dropboxJsonUrl?: string;
  viewerEmbedUrl?: string;
  routeStatus: "active" | "inactive";
};

export type MedalCategory = "Six World Majors" | "Andes" | "Otras";

export type Medal = {
  id: string;
  slug: string;
  raceName: string;
  city: string;
  country: string;
  date: string; // ISO
  distanceKm: number;
  officialTime?: string;
  category: MedalCategory;
  medalImage: string;
  raceImage?: string;
  description?: string;
  raceLink?: string;
  status: ContentStatus;
};

export type Race = {
  id: string;
  slug: string;
  title: string;
  routeId?: string;
  locationId?: string;
  date?: string;
  status: ContentStatus;
};

export type StoryType = "blog" | "interview" | "chronicle" | "postcard";

export type Story = {
  id: string;
  slug: string;
  storyType: StoryType;
  title: string;
  date: string;
  status: ContentStatus;
};

export type AssetType = "photograph" | "audio" | "video";
export type DestinationType = "race" | "story" | "profile";
export type RelationRole =
  | "cover"
  | "gallery"
  | "testimonial"
  | "reference"
  | "trajectory";

export type ContentRelation = {
  id: string;
  assetType: AssetType;
  assetId: string;
  destinationType: DestinationType;
  destinationId: string;
  role: RelationRole;
  displayOrder: number;
};

// Tipos del paquete web generado por scripts/sync-rumbo.mjs a partir del
// Excel maestro (RUMBO/04_PUBLICACION_WEB -> public/data/rumbo). Estos son
// los unicos tipos que deben usar Home, Carreras, Historias y el mapa.

export type ConfidenceLevel = "alta" | "media" | "baja" | "pendiente" | null;

export type CarreraWeb = {
  id: string;
  slug: string;
  titulo: string;
  descripcionCorta: string | null;
  descripcionCompleta: string | null;
  fecha: string | null;
  fechaJornada: string | null;
  fechaPublica: string | null;
  provincia: string | null;
  canton: string | null;
  lugar: string | null;
  distanciaKm: number | null;
  duracionSeg: number | null;
  desnivelM: number | null;
  caloriasKcal: number | null;
  deporte: string | null;
  deporteConfianza: ConfidenceLevel;
  subdeporte: string | null;
  ubicacionFuente: string | null;
  ubicacionConfianza: ConfidenceLevel;
  imagenPrincipal: string | null;
  galeria: string[];
  rutaGeojson: string | null;
  estado: string | null;
};

export type HistoriaEstadoEditorial =
  | "propuesta_cowork"
  | "pendiente_revision"
  | "aprobada_fidel"
  | "rechazada"
  | "publicada";

export type HistoriaWeb = {
  id: string;
  slug: string;
  tipo: string | null;
  titulo: string;
  extracto: string | null;
  fraseDestacada: string | null;
  contenidoCompleto: string | null;
  fecha: string | null;
  lugar: string | null;
  imagen: string | null;
  medios: string[];
  estadoEditorial: HistoriaEstadoEditorial;
};

export type CantonWeb = {
  cantonId: string;
  provincia: string;
  canton: string;
  visitado: boolean;
  numCarreras: number;
  kmAcumulados: number;
  fechaUltimaCarrera: string | null;
  carrerasIds: string[];
};

export type ResumenWeb = {
  cantonesVisitados: number;
  metaCantones: number;
  cantonesVigentesCatalogo: number;
  kilometros: number;
  metaKilometros: number;
  vo2max: number | null;
  recuperacion: number | null;
  caloriasPromedio: number | null;
  ultimaActualizacion: string;
};

export type MedioWeb = {
  mediaId: string;
  tipo: string | null;
  titulo: string | null;
  descripcion: string | null;
  rutaWeb: string | null;
  credito: string | null;
  fuente: string | null;
  licencia: string | null;
  estado: string | null;
};
