import { createFileRoute, notFound } from "@tanstack/react-router";
import { BitacoraSection, formatDate } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/cuadernos-documentos/$slug")({
  loader: ({ params }) => {
    const n = repo.bitacora.byId(params.slug);
    if (!n || n.categoria !== "documentos") throw notFound();
    return { slug: params.slug };
  },
  notFoundComponent: () => (
    <BitacoraSection eyebrow="BITÁCORA · 02" title="No encontrado">
      <p className="text-on-surface/60">Este cuaderno o documento no está disponible.</p>
    </BitacoraSection>
  ),
  errorComponent: ({ error }) => (
    <BitacoraSection eyebrow="BITÁCORA · 02" title="Error">
      <p role="alert" className="text-on-surface/60">{error.message}</p>
    </BitacoraSection>
  ),
  component: DocumentoDetail,
});

function DocumentoDetail() {
  const { slug } = Route.useParams();
  const n = repo.bitacora.byId(slug)!;

  return (
    <BitacoraSection eyebrow={`BITÁCORA · 02 · ${(n.tipoArchivo ?? "documento").toUpperCase()}`} title={n.titulo ?? n.nombre ?? "Documento"}>
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-on-surface/70">
        <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(n.fechaPublica ?? n.fechaIngreso)}</span>
        {n.lugar && <span>{[n.lugar, n.canton, n.provincia].filter(Boolean).join(", ")}</span>}
      </div>
      {n.descripcion && <p className="font-serif mb-6 max-w-2xl text-on-surface/70">{n.descripcion}</p>}

      {n.rutaWeb ? (
        <div className="border border-outline-variant bg-surface-container-lowest p-6">
          <a href={n.rutaWeb} target="_blank" rel="noopener noreferrer" className="text-label-caps text-xs tracking-[0.2em] text-primary hover:underline">
            Abrir {n.nombre}
          </a>
        </div>
      ) : (
        <div className="border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface/60">
          Archivo no disponible.
        </div>
      )}

      {n.hash && (
        <p className="mt-6 break-all font-mono text-[10px] text-on-surface/40">HASH SHA-256: {n.hash}</p>
      )}
    </BitacoraSection>
  );
}
