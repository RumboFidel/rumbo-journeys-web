import type { ContentStatus, Story, StoryType } from "./types";
import { HISTORIAS_WEB } from "./rumbo-web";

// Adaptador de compatibilidad: expone las Historias reales (generadas desde
// el Excel via rumbo-web.ts) con la forma minima que usan los enlaces de
// relaciones de la Bitacora. La pagina /historias debe usar repo.historias
// (HistoriaWeb), no este adaptador.
function mapEstado(estado: string): ContentStatus {
  if (estado === "publicada") return "published";
  if (estado === "aprobada_fidel") return "approved";
  return "draft";
}

function mapTipo(tipo: string | null): StoryType {
  if (tipo === "blog" || tipo === "interview" || tipo === "chronicle" || tipo === "postcard") return tipo;
  return "blog";
}

export const STORIES: Story[] = HISTORIAS_WEB.map((h) => ({
  id: h.id,
  slug: h.slug,
  storyType: mapTipo(h.tipo),
  title: h.titulo,
  date: h.fecha ?? "",
  status: mapEstado(h.estadoEditorial),
}));

export function getStoryById(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
