import type { Audio } from "./types";

// Datos mock — reemplazables por la colección "Audios".
// audioUrl usa data-URIs vacías por ahora; el reproductor renderiza igual.
const SILENT_MP3 =
  "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//////////////////////////////////////////8AAAA5TEFNRTMuMTAwAc0AAAAAAAAAABSAJAJAQgAAgAAAASDs90hvAAAAAAD/+xDEAAPH3Yy/kBEAI+bBl/IEEATV1QAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVU=";

export const AUDIOS: Audio[] = [
  {
    id: "audio-viento-cotopaxi",
    slug: "viento-cotopaxi",
    title: "Viento sobre el refugio",
    audioUrl: SILENT_MP3,
    durationSeconds: 74,
    captureDate: "2026-05-14",
    publicationDate: "2026-05-15",
    locationId: "loc-cotopaxi-refugio",
    description:
      "Grabación ambiental de un minuto y catorce segundos justo antes del amanecer.",
    transcript: "Sin voz. Grabación ambiental del viento a 4.864 m.",
    status: "published",
    createdAt: "2026-05-14T05:20:00Z",
    updatedAt: "2026-05-15T09:00:00Z",
    publishedAt: "2026-05-15T09:00:00Z",
  },
  {
    id: "audio-mercado-cuenca",
    slug: "mercado-cuenca",
    title: "Mercado 10 de Agosto",
    audioUrl: SILENT_MP3,
    durationSeconds: 132,
    captureDate: "2026-04-22",
    publicationDate: "2026-04-23",
    locationId: "loc-cuenca-tomebamba",
    description:
      "Conversación breve con doña Rosa, vendedora de mote pillo desde 1992.",
    status: "published",
    createdAt: "2026-04-22T09:30:00Z",
    updatedAt: "2026-04-23T08:00:00Z",
    publishedAt: "2026-04-23T08:00:00Z",
  },
  {
    id: "audio-olas-atacames",
    slug: "olas-atacames",
    title: "Olas en Atacames",
    audioUrl: SILENT_MP3,
    durationSeconds: 96,
    captureDate: "2026-06-30",
    publicationDate: "2026-07-01",
    locationId: "loc-atacames-malecon",
    description: "Marea baja al final de la etapa.",
    status: "published",
    createdAt: "2026-06-30T18:00:00Z",
    updatedAt: "2026-07-01T09:00:00Z",
    publishedAt: "2026-07-01T09:00:00Z",
  },
];
