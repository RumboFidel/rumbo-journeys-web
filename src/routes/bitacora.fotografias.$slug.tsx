import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate } from "@/components/bitacora-shell";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/fotografias/$slug")({
  loader: ({ params }) => {
    const photo = repo.bitacora.byId(params.slug);
    if (!photo || photo.categoria !== "fotografias") throw notFound();
    return { slug: params.slug };
  },
  notFoundComponent: () => (
    <BitacoraSection eyebrow="BITÁCORA · 01" title="Fotografía no encontrada">
      <p className="text-on-surface/60">Esta fotografía no está disponible.</p>
    </BitacoraSection>
  ),
  errorComponent: ({ error }) => (
    <BitacoraSection eyebrow="BITÁCORA · 01" title="Error">
      <p role="alert" className="text-on-surface/60">{error.message}</p>
    </BitacoraSection>
  ),
  component: FotografiaDetail,
});

function FotografiaDetail() {
  const { slug } = Route.useParams();
  const photo = repo.bitacora.byId(slug)!;
  const all = repo.bitacora
    .byCategoria("fotografias")
    .slice()
    .sort((a, b) => (b.fechaPublica ?? b.fechaIngreso ?? "").localeCompare(a.fechaPublica ?? a.fechaIngreso ?? ""));
  const idx = all.findIndex((p) => p.id === photo.id);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <BitacoraSection eyebrow="BITÁCORA · 01 · FOTOGRAFÍA" title={photo.titulo ?? photo.nombre ?? "Fotografía"}>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="md:col-span-2">
          {photo.rutaWeb ? (
            <img src={photo.rutaWeb} alt={photo.titulo ?? ""} className="w-full border border-outline-variant object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center border border-dashed border-outline-variant text-sm text-on-surface/40">
              Sin imagen
            </div>
          )}
        </div>
        <aside className="space-y-5 text-sm">
          <div>
            <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">FECHA</span>
            <p className="mt-1 text-on-surface">{formatDate(photo.fechaPublica ?? photo.fechaIngreso)}</p>
          </div>
          {photo.lugar && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">LUGAR</span>
              <p className="mt-1 text-on-surface">{photo.lugar}</p>
              <p className="text-on-surface/60">{[photo.canton, photo.provincia].filter(Boolean).join(", ")}</p>
            </div>
          )}
          {photo.origen && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">ORIGEN</span>
              <p className="mt-1 text-on-surface/70">{photo.origen}</p>
            </div>
          )}
          {photo.descripcion && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DESCRIPCIÓN</span>
              <p className="font-serif mt-1 text-on-surface/70">{photo.descripcion}</p>
            </div>
          )}
          {photo.hash && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">HASH SHA-256</span>
              <p className="mt-1 break-all font-mono text-[10px] text-on-surface/50">{photo.hash}</p>
            </div>
          )}
        </aside>
      </div>

      <nav className="mt-14 flex items-center justify-between gap-4 border-t border-outline-variant pt-6 text-sm">
        {prev ? (
          <Link to="/bitacora/fotografias/$slug" params={{ slug: prev.id }} className="inline-flex items-center gap-2 text-on-surface hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {prev.titulo ?? "Anterior"}
          </Link>
        ) : <span />}
        {next ? (
          <Link to="/bitacora/fotografias/$slug" params={{ slug: next.id }} className="inline-flex items-center gap-2 text-on-surface hover:text-primary">
            {next.titulo ?? "Siguiente"} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : <span />}
      </nav>
    </BitacoraSection>
  );
}
