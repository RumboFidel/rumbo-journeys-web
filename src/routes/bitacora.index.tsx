import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Image as ImageIcon,
  FileText,
  Mic,
  Video,
  Map,
  Trophy,
  ArrowUpRight,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { bitacoraCounts } from "@/data/repository";

export const Route = createFileRoute("/bitacora/")({
  head: () => ({
    meta: [
      { title: "BITÁCORA — rumbo" },
      {
        name: "description",
        content:
          "Mundo 03 · BITÁCORA. Archivo vivo de la expedición: fotografías, cuadernos, audios, videos, rutas y medallas.",
      },
    ],
  }),
  component: BitacoraPage,
});

type CardTo =
  | "/bitacora/fotografias"
  | "/bitacora/cuadernos-documentos"
  | "/bitacora/audios"
  | "/bitacora/videos"
  | "/bitacora/rutas-gpx"
  | "/bitacora/medallas";

function BitacoraPage() {
  const counts = bitacoraCounts();

  const CATS: {
    name: string;
    label: string;
    count: number;
    icon: LucideIcon;
    to: CardTo;
  }[] = [
    { name: "Fotografías", label: "Fotografías", count: counts.fotografias, icon: ImageIcon, to: "/bitacora/fotografias" },
    { name: "Cuadernos y documentos", label: "Cuadernos y documentos", count: counts.documentos, icon: FileText, to: "/bitacora/cuadernos-documentos" },
    { name: "Audios", label: "Audios", count: counts.audios, icon: Mic, to: "/bitacora/audios" },
    { name: "Videos", label: "Videos", count: counts.videos, icon: Video, to: "/bitacora/videos" },
    { name: "Rutas", label: "Rutas", count: counts.rutas, icon: Map, to: "/bitacora/rutas-gpx" },
    { name: "Medallas", label: "Medallas", count: counts.medals, icon: Trophy, to: "/bitacora/medallas" },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />
      <main className="pt-24">
        <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
          <div className="mb-10 md:mb-14">
            <span className="text-label-caps text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              ARCHIVO VIVO · PRIVADO
            </span>
            <h1 className="font-display mt-4 text-4xl font-extrabold text-on-surface md:text-6xl">
              Bitácora viva
            </h1>
            <p className="font-serif mt-4 max-w-2xl text-base leading-relaxed text-on-surface/60">
              Un archivo narrativo del territorio, el camino y las historias.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
            {/* Sidebar */}
            <aside>
              <nav className="flex flex-col gap-1">
                <span className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  Dashboard
                </span>
                {CATS.map((c) => (
                  <Link
                    key={c.to}
                    to={c.to}
                    className="flex items-center gap-3 rounded-md px-4 py-3 text-sm text-on-surface/70 transition hover:bg-surface-container-lowest hover:text-on-surface"
                  >
                    <c.icon className="h-4 w-4" aria-hidden />
                    {c.name}
                  </Link>
                ))}
              </nav>
            </aside>

            {/* Cards grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CATS.map((c) => (
                <Link
                  key={c.to}
                  to={c.to}
                  className="group relative flex flex-col justify-between rounded-lg border border-outline-variant bg-surface-container-lowest p-6 transition duration-300 hover:border-primary/60"
                >
                  <ArrowUpRight
                    className="absolute right-5 top-5 h-4 w-4 text-on-surface/40 transition group-hover:text-primary"
                    aria-hidden
                  />
                  <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <c.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="mt-10">
                    <div className="font-display text-5xl font-extrabold text-on-surface">
                      {c.count}
                    </div>
                    <div className="font-serif mt-2 text-sm text-on-surface/60">
                      {c.label}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
