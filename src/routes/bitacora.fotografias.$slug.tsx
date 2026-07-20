import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate } from "@/components/bitacora-shell";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/fotografias/$slug")({
  loader: ({ params }) => {
    const photo = repo.photographs.bySlug(params.slug);
    if (!photo) throw notFound();
    return { slug: params.slug };
  },
  notFoundComponent: () => (
    <BitacoraSection eyebrow="BITÁCORA · 01" title="Fotografía no encontrada">
      <p className="text-on-surface/60">Esta fotografía no está disponible o aún no ha sido publicada.</p>
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
  const photo = repo.photographs.bySlug(slug)!;
  const loc = repo.locations.byId(photo.locationId);
  const all = repo.photographs.all().slice().sort((a, b) => (b.captureDate ?? "").localeCompare(a.captureDate ?? ""));
  const idx = all.findIndex((p) => p.id === photo.id);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  const relations = repo.relations.forAsset("photograph", photo.id);
  const links = relations.map((r) => {
    if (r.destinationType === "race") {
      const race = repo.races.byId(r.destinationId);
      return race ? { to: "/carreras" as const, label: `Carrera · ${race.title}` } : null;
    }
    if (r.destinationType === "story") {
      const story = repo.stories.byId(r.destinationId);
      return story ? { to: "/historias" as const, label: `Historia · ${story.title}` } : null;
    }
    if (r.destinationType === "profile") {
      return { to: "/quien-soy" as const, label: "¿Quién soy?" };
    }
    return null;
  }).filter(Boolean) as { to: "/carreras" | "/historias" | "/quien-soy"; label: string }[];

  return (
    <BitacoraSection eyebrow="BITÁCORA · 01 · FOTOGRAFÍA" title={photo.title ?? "Fotografía"}>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="md:col-span-2">
          <img src={photo.imageUrl} alt={photo.title ?? ""} className="w-full border border-outline-variant object-cover" />
        </div>
        <aside className="space-y-5 text-sm">
          <div>
            <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">FECHA</span>
            <p className="mt-1 text-on-surface">{formatDate(photo.captureDate)}</p>
          </div>
          {loc && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">LUGAR</span>
              <p className="mt-1 text-on-surface">{loc.visibleName}</p>
              <p className="text-on-surface/60">{loc.canton}, {loc.province}</p>
              <p className="mt-1 font-mono text-xs text-on-surface/50">
                {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}° {loc.altitude ? `· ${loc.altitude} m` : ""}
              </p>
            </div>
          )}
          {photo.credit && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">CRÉDITO</span>
              <p className="mt-1 text-on-surface/70">{photo.credit}</p>
            </div>
          )}
          {photo.description && (
            <div>
              <span className="text-label-caps text-[10px] tracking-[0.3em] text-primary">DESCRIPCIÓN</span>
              <p className="font-serif mt-1 text-on-surface/70">{photo.description}</p>
            </div>
          )}
        </aside>
      </div>

      {links.length > 0 && (
        <section className="mt-14 border-t border-outline-variant pt-8">
          <span className="text-label-caps text-[10px] tracking-[0.4em] text-primary">ESTA FOTOGRAFÍA APARECE EN</span>
          <div className="mt-4 flex flex-wrap gap-3">
            {links.map((l, i) => (
              <Link key={i} to={l.to} className="text-label-caps border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface transition hover:border-primary/60 hover:text-primary">
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="mt-14 flex items-center justify-between gap-4 border-t border-outline-variant pt-6 text-sm">
        {prev ? (
          <Link to="/bitacora/fotografias/$slug" params={{ slug: prev.slug }} className="inline-flex items-center gap-2 text-on-surface hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {prev.title ?? "Anterior"}
          </Link>
        ) : <span />}
        {next ? (
          <Link to="/bitacora/fotografias/$slug" params={{ slug: next.slug }} className="inline-flex items-center gap-2 text-on-surface hover:text-primary">
            {next.title ?? "Siguiente"} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : <span />}
      </nav>
    </BitacoraSection>
  );
}
