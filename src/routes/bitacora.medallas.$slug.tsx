import { createFileRoute, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/medallas/$slug")({
  loader: ({ params }) => {
    if (!repo.medals.bySlug(params.slug)) throw notFound();
    return { slug: params.slug };
  },
  notFoundComponent: () => (
    <BitacoraSection eyebrow="BITÁCORA · 06" title="Medalla no encontrada">
      <p className="text-on-surface/60">Esta medalla no está disponible.</p>
    </BitacoraSection>
  ),
  errorComponent: ({ error }) => (
    <BitacoraSection eyebrow="BITÁCORA · 06" title="Error">
      <p role="alert">{error.message}</p>
    </BitacoraSection>
  ),
  component: MedalDetail,
});

function MedalDetail() {
  const { slug } = Route.useParams();
  const m = repo.medals.bySlug(slug)!;
  return (
    <BitacoraSection eyebrow={`BITÁCORA · 06 · ${m.category.toUpperCase()}`} title={m.raceName}>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="border border-outline-variant bg-surface-container-lowest">
          <img src={m.medalImage} alt={`Medalla ${m.raceName}`} className="w-full object-cover" />
        </div>
        <dl className="space-y-4 text-sm">
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">CIUDAD</dt><dd className="mt-1 text-on-surface">{m.city}, {m.country}</dd></div>
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">FECHA</dt><dd className="mt-1 text-on-surface">{formatDate(m.date)}</dd></div>
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DISTANCIA</dt><dd className="mt-1 text-on-surface">{m.distanceKm} km</dd></div>
          {m.officialTime && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">TIEMPO OFICIAL</dt><dd className="mt-1 text-on-surface">{m.officialTime}</dd></div>}
          <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">CATEGORÍA</dt><dd className="mt-1 text-on-surface">{m.category}</dd></div>
          {m.description && <div><dt className="text-label-caps text-[10px] tracking-[0.3em] text-primary">NOTA</dt><dd className="font-serif mt-1 text-on-surface/70">{m.description}</dd></div>}
          {m.raceLink && <a href={m.raceLink} target="_blank" rel="noreferrer" className="text-label-caps inline-block border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface hover:border-primary/60 hover:text-primary">SITIO DE LA CARRERA</a>}
        </dl>
      </div>
    </BitacoraSection>
  );
}
