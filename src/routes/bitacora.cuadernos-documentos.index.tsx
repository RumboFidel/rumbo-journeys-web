import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/bitacora/cuadernos-documentos/")({
  head: () => ({
    meta: [
      { title: "Cuadernos y documentos — Bitácora · rumbo" },
      { name: "description", content: "Notas y documentos originales registrados en la Bitácora de RUMBO." },
    ],
  }),
  component: DocumentosIndex,
});

function DocumentosIndex() {
  const items = repo.bitacora.byCategoria("documentos");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((n) => !query || `${n.titulo ?? ""} ${n.descripcion ?? ""} ${n.lugar ?? ""}`.toLowerCase().includes(query));
    arr.sort((a, b) => {
      const da = a.fechaPublica ?? a.fechaIngreso ?? "";
      const db = b.fechaPublica ?? b.fechaIngreso ?? "";
      return order === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return arr;
  }, [items, q, order]);

  const clear = () => { setQ(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 02" title="Cuadernos y documentos" intro="Notas y documentos originales cargados por Fidel, registrados en la Bitácora.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option><option value="asc">Más antiguos</option>
          </select>
        </Field>
      </FiltersBar>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-on-surface/50">Todavía no hay cuadernos ni documentos registrados en la Bitácora.</p>
      ) : filtered.length === 0 ? <EmptyResults /> : (
        <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest">
          {filtered.map((n) => (
            <li key={n.id}>
              <Link to="/bitacora/cuadernos-documentos/$slug" params={{ slug: n.id }} className="flex flex-col gap-3 p-5 transition hover:bg-background md:flex-row md:items-center md:gap-6">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center border border-outline-variant bg-surface-container-low">
                  <FileText className="h-6 w-6 text-on-surface/40" aria-hidden />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-label-caps text-[9px] tracking-[0.3em] text-primary">{(n.tipoArchivo ?? "documento").toUpperCase()}</span>
                    <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(n.fechaPublica ?? n.fechaIngreso)}</span>
                  </div>
                  <h2 className="font-display mt-1 text-lg font-extrabold leading-tight text-on-surface">{n.titulo}</h2>
                  <p className="mt-1 text-xs text-on-surface/60">{[n.lugar, n.canton, n.provincia].filter(Boolean).join(" · ")}</p>
                  {n.descripcion && <p className="mt-2 text-sm text-on-surface/70">{n.descripcion}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BitacoraSection>
  );
}
