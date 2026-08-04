import { createFileRoute, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate, formatDuration } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/audios/$slug")({
  loader: ({ params }) => {
    const a = repo.bitacora.byId(params.slug);
    if (!a || a.categoria !== "audios") throw notFound();
    return { slug: params.slug };
  },
  notFoundComponent: () => (
    <BitacoraSection eyebrow="BITÁCORA · 03" title="Audio no encontrado">
      <p className="text-on-surface/60">Este audio no está disponible.</p>
    </BitacoraSection>
  ),
  errorComponent: ({ error }) => (
    <BitacoraSection eyebrow="BITÁCORA · 03" title="Error">
      <p role="alert">{error.message}</p>
    </BitacoraSection>
  ),
  component: AudioDetail,
});

function AudioDetail() {
  const { slug } = Route.useParams();
  const a = repo.bitacora.byId(slug)!;

  return (
    <BitacoraSection eyebrow="BITÁCORA · 03 · AUDIO" title={a.titulo ?? a.nombre ?? "Audio"}>
      {a.rutaWeb && <audio controls preload="none" className="w-full" src={a.rutaWeb} />}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">FECHA</dt><dd className="mt-1 text-on-surface">{formatDate(a.fechaPublica ?? a.fechaIngreso)}</dd></div>
          {a.lugar && <div>
            <dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">LUGAR</dt>
            <dd className="mt-1 text-on-surface">{a.lugar}</dd>
            <dd className="text-on-surface/60">{[a.canton, a.provincia].filter(Boolean).join(", ")}</dd>
          </div>}
          {a.duracionSegundos != null && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DURACIÓN</dt><dd className="mt-1 text-on-surface">{formatDuration(a.duracionSegundos)}</dd></div>}
        </dl>
        <div className="space-y-3 text-sm">
          {a.descripcion && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DESCRIPCIÓN</dt><p className="font-serif mt-1 text-on-surface/70">{a.descripcion}</p></div>}
          {a.origen && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">ORIGEN</dt><p className="mt-1 text-on-surface/70">{a.origen}</p></div>}
          {a.hash && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">HASH SHA-256</dt><p className="mt-1 break-all font-mono text-[10px] text-on-surface/50">{a.hash}</p></div>}
        </div>
      </div>
    </BitacoraSection>
  );
}
