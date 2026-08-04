import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { repo } from "@/data/repository";
import type { HistoriaWeb } from "@/data/types";

export const Route = createFileRoute("/historias")({
  head: () => ({
    meta: [
      { title: "HISTORIAS — rumbo" },
      {
        name: "description",
        content:
          "Mundo 02 · HISTORIAS. Lugares, comidas, personas, entrevistas y lo que va a redes sociales.",
      },
    ],
  }),
  component: HistoriasPage,
});

const MESES_LARGO_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDate(d: string | null) {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const [, y, mo, day] = m;
  const idx = parseInt(mo, 10) - 1;
  if (idx < 0 || idx > 11) return d;
  return `${day} de ${MESES_LARGO_ES[idx]} de ${y}`;
}

function HistoriasPage() {
  const [query, setQuery] = useState("");
  const all = repo.historias.all();

  const historias = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? all.filter(
          (h) =>
            h.titulo.toLowerCase().includes(q) ||
            (h.extracto ?? "").toLowerCase().includes(q) ||
            (h.tipo ?? "").toLowerCase().includes(q),
        )
      : all;
    return [...list].sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  }, [all, query]);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />

      <main className="pt-24">
        <section className="mx-auto max-w-6xl px-6 py-12 md:px-16 md:py-20">
          <div className="mb-10 flex flex-col items-center text-center md:mb-14">
            <span className="text-label-caps mb-4 text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              MUNDO 02
            </span>
            <h1 className="font-display text-4xl font-extrabold text-on-surface md:text-6xl">
              HISTORIAS
            </h1>
            <p className="font-serif mt-6 max-w-2xl text-base leading-relaxed text-on-surface/60">
              Lugares, comidas, personas, entrevistas y lo que va a redes sociales.
              Historias del camino, no de la carrera.
            </p>

          </div>

          {/* Buscador */}
          <div className="mb-10 mx-auto max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface/40" aria-hidden />
              <Input
                type="text"
                placeholder="Buscar historia..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 bg-surface-container border-outline-variant text-on-surface placeholder:text-on-surface/40 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Mosaico */}
          {all.length === 0 ? (
            <p className="py-20 text-center text-sm text-on-surface/50">
              Todavía no hay Historias aprobadas por Fidel. Cuando apruebe una, aparecerá aquí.
            </p>
          ) : historias.length === 0 ? (
            <p className="py-20 text-center text-sm text-on-surface/50">
              No encontramos historias con ese término.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {historias.map((h) => (
                <HistoriaCard key={h.slug} h={h} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function HistoriaCard({ h }: { h: HistoriaWeb }) {
  const isWide = h.tipo === "fotopostal";
  const imagen = repo.medios.byId(h.imagen)?.rutaWeb;
  const medios = h.medios.map((id) => repo.medios.byId(id)).filter((m): m is NonNullable<typeof m> => !!m);
  const video = medios.find((m) => m.tipo === "video");

  return (
    <Dialog>
      <article
        className={`group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60 ${
          isWide ? "md:col-span-2" : ""
        }`}
      >
        <div
          className={`relative overflow-hidden ${
            isWide ? "aspect-[16/9]" : "aspect-[4/3]"
          }`}
        >
          {imagen ? (
            <img
              src={imagen}
              alt={h.titulo}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center border border-dashed border-outline-variant text-xs text-on-surface/40">
              Sin imagen todavía
            </div>
          )}
          {h.tipo && (
            <span className="text-label-caps absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 text-[9px] tracking-[0.3em] text-primary">
              {h.tipo.toUpperCase()}
            </span>
          )}
          {h.tipo === "video" && (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background/70 text-primary">
                ▶
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5 md:p-6">
          <span className="text-label-caps mb-2 text-[10px] font-bold tracking-[0.3em] text-primary">
            {formatDate(h.fecha).toUpperCase()}
          </span>
          <h2
            className={`font-display font-extrabold leading-tight text-on-surface ${
              isWide ? "text-2xl md:text-3xl" : "text-xl"
            }`}
          >
            {h.titulo}
          </h2>
          {h.extracto && (
            <p className="font-serif mt-3 line-clamp-4 text-sm leading-relaxed text-on-surface/70">
              {h.extracto}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 pt-3">
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-label-caps inline-flex items-center justify-center bg-primary px-4 py-2 text-[10px] tracking-[0.2em] text-on-primary transition hover:brightness-110"
              >
                CONOCER MÁS
              </button>
            </DialogTrigger>
          </div>
        </div>
      </article>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-outline-variant bg-surface-container p-0">
        {/* Slot unico de medio principal: video si existe, si no la imagen. Nunca ambos a la vez. */}
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {video?.rutaWeb ? (
            <video src={video.rutaWeb} controls className="h-full w-full" />
          ) : imagen ? (
            <img src={imagen} alt={h.titulo} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-on-surface/40">
              Sin imagen todavía
            </div>
          )}
          {h.tipo && !video?.rutaWeb && (
            <span className="text-label-caps absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 text-[9px] tracking-[0.3em] text-primary">
              {h.tipo.toUpperCase()}
            </span>
          )}
        </div>
        <div className="p-6 md:p-8">
          <DialogHeader>
            <span className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.3em] text-primary">
              {formatDate(h.fecha).toUpperCase()}
            </span>
            <DialogTitle className="font-display text-2xl font-extrabold leading-tight text-on-surface md:text-3xl">
              {h.titulo}
            </DialogTitle>
          </DialogHeader>

          {h.fraseDestacada && (
            <blockquote className="font-serif mt-6 border-l-2 border-primary/60 pl-4 text-lg italic leading-relaxed text-on-surface/90">
              "{h.fraseDestacada}"
            </blockquote>
          )}

          <div className="font-serif mt-6 space-y-4 text-base leading-relaxed text-on-surface/80">
            {h.contenidoCompleto ? (
              h.contenidoCompleto.split("\n").map((paragraph, idx) =>
                paragraph.trim() ? <p key={idx}>{paragraph.trim()}</p> : null
              )
            ) : h.extracto ? (
              <p>{h.extracto}</p>
            ) : (
              <p className="text-sm text-on-surface/50">Todavía no hay texto completo para esta Historia.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
