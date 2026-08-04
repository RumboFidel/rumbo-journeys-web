import { createFileRoute, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate, formatDuration } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/videos/$slug")({
  loader: ({ params }) => {
    const v = repo.bitacora.byId(params.slug);
    if (!v || v.categoria !== "videos") throw notFound();
    return { slug: params.slug };
  },
  notFoundComponent: () => (
    <BitacoraSection eyebrow="BITÁCORA · 04" title="Video no encontrado">
      <p className="text-on-surface/60">Este video no está disponible.</p>
    </BitacoraSection>
  ),
  errorComponent: ({ error }) => (
    <BitacoraSection eyebrow="BITÁCORA · 04" title="Error">
      <p role="alert">{error.message}</p>
    </BitacoraSection>
  ),
  component: VideoDetail,
});

function VideoDetail() {
  const { slug } = Route.useParams();
  const v = repo.bitacora.byId(slug)!;

  return (
    <BitacoraSection eyebrow="BITÁCORA · 04 · VIDEO" title={v.titulo ?? v.nombre ?? "Video"}>
      <div className="relative aspect-video w-full overflow-hidden border border-outline-variant bg-black">
        {v.rutaWeb ? (
          <video controls className="h-full w-full" src={v.rutaWeb} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-on-surface/50">Sin archivo disponible</div>
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">FECHA</dt><dd className="mt-1 text-on-surface">{formatDate(v.fechaPublica ?? v.fechaIngreso)}</dd></div>
          {v.duracionSegundos != null && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DURACIÓN</dt><dd className="mt-1 text-on-surface">{formatDuration(v.duracionSegundos)}</dd></div>}
          {v.lugar && <div>
            <dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">LUGAR</dt>
            <dd className="mt-1 text-on-surface">{v.lugar}</dd>
            <dd className="text-on-surface/60">{[v.canton, v.provincia].filter(Boolean).join(", ")}</dd>
          </div>}
        </dl>
        <div className="space-y-3 text-sm">
          {v.descripcion && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DESCRIPCIÓN</dt><p className="font-serif mt-1 text-on-surface/70">{v.descripcion}</p></div>}
          {v.origen && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">ORIGEN</dt><p className="mt-1 text-on-surface/70">{v.origen}</p></div>}
        </div>
      </div>
    </BitacoraSection>
  );
}
