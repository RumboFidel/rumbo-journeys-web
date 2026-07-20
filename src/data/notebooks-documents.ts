import type { NotebookDocument } from "./types";
import storySabiduria from "@/assets/story-sabiduria.jpg.asset.json";
import raceCuenca from "@/assets/race-cuenca.jpg.asset.json";

// Datos mock — reemplazables por la colección "Cuadernos_Documentos".
export const NOTEBOOKS_DOCUMENTS: NotebookDocument[] = [
  {
    id: "nb-cuaderno-01",
    slug: "cuaderno-01-quito-cotopaxi",
    title: "Cuaderno 01 · Quito → Cotopaxi",
    kind: "notebook",
    format: "pdf",
    pageCount: 62,
    coverUrl: storySabiduria.url,
    captureDate: "2026-03-05",
    publicationDate: "2026-03-10",
    locationId: "loc-quito-centro",
    description:
      "Notas manuscritas de las primeras dos semanas. Rutas trazadas a lápiz sobre mapas del IGM.",
    status: "published",
    createdAt: "2026-03-05T20:00:00Z",
    updatedAt: "2026-03-10T09:00:00Z",
    publishedAt: "2026-03-10T09:00:00Z",
  },
  {
    id: "nb-cuaderno-03",
    slug: "cuaderno-03-cotopaxi-cuenca",
    title: "Cuaderno 03 · Cotopaxi → Cuenca",
    kind: "notebook",
    format: "pdf",
    pageCount: 78,
    coverUrl: storySabiduria.url,
    captureDate: "2026-05-14",
    publicationDate: "2026-05-20",
    locationId: "loc-cotopaxi-refugio",
    description:
      "El cuaderno del refugio. Página 47: la nota de las 17:42 que abrió el Mundo 03.",
    status: "published",
    createdAt: "2026-05-14T21:00:00Z",
    updatedAt: "2026-05-20T09:00:00Z",
    publishedAt: "2026-05-20T09:00:00Z",
  },
  {
    id: "doc-permiso-cotopaxi",
    slug: "permiso-cotopaxi",
    title: "Permiso · Parque Nacional Cotopaxi",
    kind: "document",
    format: "pdf",
    pageCount: 3,
    coverUrl: raceCuenca.url,
    captureDate: "2026-05-10",
    publicationDate: "2026-05-11",
    locationId: "loc-cotopaxi-refugio",
    description:
      "Autorización oficial de ingreso emitida por el Ministerio del Ambiente.",
    status: "published",
    createdAt: "2026-05-10T10:00:00Z",
    updatedAt: "2026-05-11T09:00:00Z",
    publishedAt: "2026-05-11T09:00:00Z",
  },
  {
    id: "doc-prensa-guayaquil",
    slug: "prensa-guayaquil",
    title: "Nota de prensa · El Universo",
    kind: "document",
    format: "external",
    coverUrl: raceCuenca.url,
    captureDate: "2026-06-13",
    publicationDate: "2026-06-13",
    locationId: "loc-guayaquil-laspenas",
    description:
      "Recorte del reportaje sobre la etapa de Las Peñas publicado un día después.",
    status: "published",
    createdAt: "2026-06-13T09:00:00Z",
    updatedAt: "2026-06-13T09:00:00Z",
    publishedAt: "2026-06-13T09:00:00Z",
  },
];
