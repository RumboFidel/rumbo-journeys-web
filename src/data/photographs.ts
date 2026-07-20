import type { Photograph } from "./types";
import heroAndes from "@/assets/hero-andes.jpg.asset.json";
import storyCotopaxi from "@/assets/story-cotopaxi.jpg.asset.json";
import storySabiduria from "@/assets/story-sabiduria.jpg.asset.json";
import raceQuito from "@/assets/race-quito.jpg.asset.json";
import raceCuenca from "@/assets/race-cuenca.jpg.asset.json";

// Datos mock — reemplazables por la colección "Fotografias".
export const PHOTOGRAPHS: Photograph[] = [
  {
    id: "photo-cotopaxi-amanecer",
    slug: "cotopaxi-amanecer",
    title: "Amanecer sobre el Cotopaxi",
    imageUrl: storyCotopaxi.url,
    captureDate: "2026-05-14",
    publicationDate: "2026-05-15",
    locationId: "loc-cotopaxi-refugio",
    description:
      "Primer sol sobre la nieve del cráter. Cuarenta minutos antes ya se escuchaba el viento subir por la ladera.",
    credit: "Fidel Jaramillo",
    status: "published",
    createdAt: "2026-05-14T05:40:00Z",
    updatedAt: "2026-05-15T09:00:00Z",
    capturedAt: "2026-05-14T05:42:00Z",
    publishedAt: "2026-05-15T09:00:00Z",
  },
  {
    id: "photo-las-penas-escaleras",
    slug: "las-penas-escaleras",
    title: "444 escalones de Las Peñas",
    imageUrl: raceQuito.url,
    captureDate: "2026-06-12",
    publicationDate: "2026-06-13",
    locationId: "loc-guayaquil-laspenas",
    description:
      "La subida al Cerro Santa Ana antes del bullicio matinal del puerto.",
    credit: "Fidel Jaramillo",
    status: "published",
    createdAt: "2026-06-12T06:20:00Z",
    updatedAt: "2026-06-13T10:00:00Z",
    publishedAt: "2026-06-13T10:00:00Z",
  },
  {
    id: "photo-cuenca-tomebamba",
    slug: "cuenca-tomebamba",
    title: "El Tomebamba al mediodía",
    imageUrl: raceCuenca.url,
    captureDate: "2026-04-22",
    publicationDate: "2026-04-23",
    locationId: "loc-cuenca-tomebamba",
    description:
      "El río corta la ciudad en dos. Del lado del barranco, la luz siempre llega tarde.",
    credit: "Fidel Jaramillo",
    status: "published",
    createdAt: "2026-04-22T12:10:00Z",
    updatedAt: "2026-04-23T08:00:00Z",
    publishedAt: "2026-04-23T08:00:00Z",
  },
  {
    id: "photo-andes-camino",
    slug: "andes-camino",
    title: "Camino de los Andes",
    imageUrl: heroAndes.url,
    captureDate: "2026-03-05",
    publicationDate: "2026-03-06",
    locationId: "loc-cotopaxi-refugio",
    description: "Sendero abierto entre pajonal, kilómetro 12 de la etapa.",
    credit: "Fidel Jaramillo",
    status: "published",
    createdAt: "2026-03-05T09:00:00Z",
    updatedAt: "2026-03-06T09:00:00Z",
    publishedAt: "2026-03-06T09:00:00Z",
  },
  {
    id: "photo-cuaderno-pagina",
    slug: "cuaderno-pagina-47",
    title: "Cuaderno 03, página 47",
    imageUrl: storySabiduria.url,
    captureDate: "2026-05-15",
    publicationDate: "2026-05-16",
    locationId: "loc-quito-centro",
    description: "Anotaciones de la etapa Cotopaxi al regreso.",
    credit: "Fidel Jaramillo",
    status: "published",
    createdAt: "2026-05-15T20:00:00Z",
    updatedAt: "2026-05-16T09:00:00Z",
    publishedAt: "2026-05-16T09:00:00Z",
  },
];
