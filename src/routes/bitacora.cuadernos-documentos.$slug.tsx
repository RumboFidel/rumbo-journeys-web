import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { BitacoraSection, formatDate } from "@/components/bitacora-shell";
import { ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/cuadernos-documentos/$slug")({
  loader: ({ params }) => {
    if (!repo.notebooksDocuments.bySlug(params.slug)) throw notFound();
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
  component: NotebookDetail,
});

// Visor de demostración. Componente reemplazable — recibirá fileUrl real
// cuando se conecte Drive. Deja preparado el contrato de la API pública.
function PdfViewer({ fileUrl, pageCount = 1 }: { fileUrl?: string; pageCount?: number }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  return (
    <div className="flex flex-col border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant p-3">
        <div className="flex items-center gap-2">
          <button aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 text-on-surface hover:text-primary"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs text-on-surface/70">Página {page} / {pageCount}</span>
          <button aria-label="Página siguiente" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="p-2 text-on-surface hover:text-primary"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="p-2 text-on-surface hover:text-primary"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs text-on-surface/70">{Math.round(zoom * 100)}%</span>
          <button aria-label="Acercar" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-2 text-on-surface hover:text-primary"><ZoomIn className="h-4 w-4" /></button>
          <button aria-label="Pantalla completa" onClick={() => {/* placeholder */}} className="p-2 text-on-surface hover:text-primary"><Maximize2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex min-h-[420px] items-center justify-center bg-background p-6">
        {fileUrl ? (
          <iframe src={fileUrl} title="Visor" className="h-[520px] w-full border-0" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }} />
        ) : (
          <div className="text-center text-sm text-on-surface/50">
            <p className="text-label-caps mb-3 text-[10px] tracking-[0.3em] text-primary">VISOR DE DOCUMENTO</p>
            <p>Espacio reservado para el PDF escaneado.</p>
            <p className="mt-1 text-xs">Se activará cuando se conecte la fuente de archivos.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotebookDetail() {
  const { slug } = Route.useParams();
  const n = repo.notebooksDocuments.bySlug(slug)!;
  const loc = repo.locations.byId(n.locationId);

  return (
    <BitacoraSection eyebrow={`BITÁCORA · 02 · ${n.kind === "notebook" ? "CUADERNO" : "DOCUMENTO"}`} title={n.title}>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-on-surface/70">
        <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(n.captureDate)}</span>
        {loc && <span>{loc.visibleName} · {loc.canton}, {loc.province}</span>}
        <span className="text-on-surface/50">{n.format.toUpperCase()}{n.pageCount ? ` · ${n.pageCount} páginas` : ""}</span>
      </div>
      {n.description && <p className="font-serif mb-6 max-w-2xl text-on-surface/70">{n.description}</p>}

      {n.format === "external" ? (
        <div className="border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface/60">
          <p className="text-label-caps mb-3 text-[10px] tracking-[0.3em] text-primary">DOCUMENTO EXTERNO</p>
          <p>Espacio reservado para “Abrir documento” cuando exista la URL final.</p>
        </div>
      ) : (
        <PdfViewer fileUrl={n.fileUrl} pageCount={n.pageCount ?? 1} />
      )}
    </BitacoraSection>
  );
}
