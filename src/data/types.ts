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
