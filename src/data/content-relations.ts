import type { ContentRelation } from "./types";

// Fuente única de relaciones entre activos multimedia y destinos.
// Reemplazable por la colección "Relaciones" del Excel/Supabase.
export const CONTENT_RELATIONS: ContentRelation[] = [
  // Fotografías → Carreras / Historias / Perfil
  { id: "rel-01", assetType: "photograph", assetId: "photo-las-penas-escaleras", destinationType: "race", destinationId: "race-guayaquil", role: "gallery", displayOrder: 1 },
  { id: "rel-02", assetType: "photograph", assetId: "photo-las-penas-escaleras", destinationType: "story", destinationId: "story-las-penas", role: "cover", displayOrder: 1 },
  { id: "rel-03", assetType: "photograph", assetId: "photo-cotopaxi-amanecer", destinationType: "race", destinationId: "race-cotopaxi", role: "cover", displayOrder: 1 },
  { id: "rel-04", assetType: "photograph", assetId: "photo-cotopaxi-amanecer", destinationType: "story", destinationId: "story-cotopaxi-1742", role: "gallery", displayOrder: 1 },
  { id: "rel-05", assetType: "photograph", assetId: "photo-cuenca-tomebamba", destinationType: "race", destinationId: "race-cuenca", role: "gallery", displayOrder: 1 },
  { id: "rel-06", assetType: "photograph", assetId: "photo-andes-camino", destinationType: "profile", destinationId: "profile-fidel", role: "trajectory", displayOrder: 1 },
  { id: "rel-07", assetType: "photograph", assetId: "photo-cuaderno-pagina", destinationType: "story", destinationId: "story-cotopaxi-1742", role: "reference", displayOrder: 2 },

  // Audios
  { id: "rel-10", assetType: "audio", assetId: "audio-viento-cotopaxi", destinationType: "race", destinationId: "race-cotopaxi", role: "reference", displayOrder: 1 },
  { id: "rel-11", assetType: "audio", assetId: "audio-mercado-cuenca", destinationType: "story", destinationId: "story-las-penas", role: "reference", displayOrder: 1 },
  { id: "rel-12", assetType: "audio", assetId: "audio-olas-atacames", destinationType: "story", destinationId: "story-hostal-atacames", role: "reference", displayOrder: 1 },

  // Videos
  { id: "rel-20", assetType: "video", assetId: "video-testimonial-guayaquil", destinationType: "race", destinationId: "race-guayaquil", role: "testimonial", displayOrder: 1 },
  { id: "rel-21", assetType: "video", assetId: "video-ruta-cotopaxi", destinationType: "race", destinationId: "race-cotopaxi", role: "reference", displayOrder: 1 },
  { id: "rel-22", assetType: "video", assetId: "video-entrevista-cuenca", destinationType: "story", destinationId: "story-las-penas", role: "reference", displayOrder: 1 },
];
