import type { Story } from "./types";

// Referencias mínimas a Historias para relacionar contenidos. La vista de
// /historias conserva su propia data narrativa.
export const STORIES: Story[] = [
  {
    id: "story-hostal-atacames",
    slug: "hostal-atacames",
    storyType: "blog",
    title: "El hostal de Atacames que me salvó la noche",
    date: "2026-06-30",
    status: "published",
  },
  {
    id: "story-las-penas",
    slug: "las-penas",
    storyType: "chronicle",
    title: "Las Peñas antes del sol",
    date: "2026-06-13",
    status: "published",
  },
  {
    id: "story-cotopaxi-1742",
    slug: "cotopaxi-1742",
    storyType: "postcard",
    title: "17:42, Cotopaxi",
    date: "2026-05-15",
    status: "published",
  },
];

export function getStoryById(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
