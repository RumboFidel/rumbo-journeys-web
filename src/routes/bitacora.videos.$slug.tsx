import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate, formatDuration } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/videos/$slug")({
  loader: ({ params }) => {
    if (!repo.videos.bySlug(params.slug)) throw notFound();
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
  const v = repo.videos.bySlug(slug)!;
  const loc = repo.locations.byId(v.locationId);
  const rels = repo.relations.forAsset("video", v.id);
  const links = rels.map((r) => {
    if (r.destinationType === "race") { const x = repo.races.byId(r.destinationId); return x ? { to: "/carreras" as const, label: `Carrera · ${x.title}` } : null; }
    if (r.destinationType === "story") { const x = repo.stories.byId(r.destinationId); return x ? { to: "/historias" as const, label: `Historia · ${x.title}` } : null; }
    if (r.destinationType === "profile") return { to: "/quien-soy" as const, label: "¿Quién soy?" };
    return null;
  }).filter(Boolean) as { to: "/carreras" | "/historias" | "/quien-soy"; label: string }[];

  return (
    <BitacoraSection eyebrow="BITÁCORA · 04 · VIDEO" title={v.title}>
      <div className="relative aspect-video w-full overflow-hidden border border-outline-variant bg-black">
        {v.videoUrl ? (
          <video controls poster={v.coverUrl} className="h-full w-full" src={v.videoUrl} />
        ) : (
          <>
            <img src={v.coverUrl} alt="" className="h-full w-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-label-caps rounded-sm bg-background/85 px-4 py-2 text-[10px] tracking-[0.3em] text-primary">REPRODUCTOR EN CONSTRUCCIÓN</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">FECHA</dt><dd className="mt-1 text-on-surface">{formatDate(v.captureDate)}</dd></div>
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DURACIÓN</dt><dd className="mt-1 text-on-surface">{formatDuration(v.durationSeconds)}</dd></div>
          {loc && <div>
            <dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">LUGAR</dt>
            <dd className="mt-1 text-on-surface">{loc.visibleName}</dd>
            <dd className="text-on-surface/60">{loc.canton}, {loc.province}</dd>
            <dd className="mt-1 font-mono text-xs text-on-surface/50">{loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°</dd>
          </div>}
        </dl>
        {v.description && <div className="text-sm"><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DESCRIPCIÓN</dt><p className="font-serif mt-1 text-on-surface/70">{v.description}</p></div>}
      </div>
      {links.length > 0 && (
        <section className="mt-10 border-t border-outline-variant pt-6">
          <span className="text-label-caps text-[10px] tracking-[0.4em] text-primary">ESTE VIDEO APARECE EN</span>
          <div className="mt-4 flex flex-wrap gap-3">
            {links.map((l, i) => <Link key={i} to={l.to} className="text-label-caps border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface hover:border-primary/60 hover:text-primary">{l.label}</Link>)}
          </div>
        </section>
      )}
    </BitacoraSection>
  );
}
