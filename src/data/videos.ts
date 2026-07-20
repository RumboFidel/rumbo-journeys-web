import type { Video } from "./types";
import raceQuito from "@/assets/race-quito.jpg.asset.json";
import raceCuenca from "@/assets/race-cuenca.jpg.asset.json";
import storyCotopaxi from "@/assets/story-cotopaxi.jpg.asset.json";

// Datos mock — reemplazables por la colección "Videos".
export const VIDEOS: Video[] = [
  {
    id: "video-testimonial-guayaquil",
    slug: "testimonial-guayaquil",
    title: "Testimonio · Guayaquil, kilómetro 8",
    videoType: "testimonial",
    coverUrl: raceQuito.url,
    durationSeconds: 128,
    captureDate: "2026-06-12",
    publicationDate: "2026-06-14",
    locationId: "loc-guayaquil-laspenas",
    description:
      "A mitad del recorrido, una pausa breve para contar lo que iba pasando por el cuerpo.",
    status: "published",
    createdAt: "2026-06-12T07:15:00Z",
    updatedAt: "2026-06-14T09:00:00Z",
    publishedAt: "2026-06-14T09:00:00Z",
  },
  {
    id: "video-ruta-cotopaxi",
    slug: "ruta-cotopaxi",
    title: "Vista aérea · sendero al refugio",
    videoType: "route",
    coverUrl: storyCotopaxi.url,
    durationSeconds: 205,
    captureDate: "2026-05-14",
    publicationDate: "2026-05-16",
    locationId: "loc-cotopaxi-refugio",
    description:
      "Traza del sendero desde el parqueadero hasta el refugio José Rivas.",
    status: "published",
    createdAt: "2026-05-14T07:00:00Z",
    updatedAt: "2026-05-16T09:00:00Z",
    publishedAt: "2026-05-16T09:00:00Z",
  },
  {
    id: "video-entrevista-cuenca",
    slug: "entrevista-cuenca",
    title: "Entrevista · panadero del Barranco",
    videoType: "interview",
    coverUrl: raceCuenca.url,
    durationSeconds: 342,
    captureDate: "2026-04-23",
    publicationDate: "2026-04-25",
    locationId: "loc-cuenca-tomebamba",
    description:
      "Don Julio hornea pan de agua desde las tres de la mañana. La conversación tomó otro rumbo.",
    status: "published",
    createdAt: "2026-04-23T04:30:00Z",
    updatedAt: "2026-04-25T09:00:00Z",
    publishedAt: "2026-04-25T09:00:00Z",
  },
];
