import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, formatDuration, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";
import { Video as VideoIcon } from "lucide-react";

export const Route = createFileRoute("/bitacora/videos/")({
  head: () => ({
    meta: [
      { title: "Videos — Bitácora · rumbo" },
      { name: "description", content: "Videos originales registrados en la Bitácora de RUMBO." },
    ],
  }),
  component: VideosIndex,
});

function VideosIndex() {
  const items = repo.bitacora.byCategoria("videos");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((v) => !query || `${v.titulo ?? ""} ${v.descripcion ?? ""} ${v.lugar ?? ""}`.toLowerCase().includes(query));
    arr.sort((a, b) => {
      const da = a.fechaPublica ?? a.fechaIngreso ?? "";
      const db = b.fechaPublica ?? b.fechaIngreso ?? "";
      return order === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return arr;
  }, [items, q, order]);

  const clear = () => { setQ(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 04" title="Videos" intro="Videos originales cargados por Fidel, registrados en la Bitácora.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option><option value="asc">Más antiguos</option>
          </select>
        </Field>
      </FiltersBar>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-on-surface/50">Todavía no hay videos registrados en la Bitácora.</p>
      ) : filtered.length === 0 ? <EmptyResults /> : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Link key={v.id} to="/bitacora/videos/$slug" params={{ slug: v.id }} className="group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60">
              <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-surface-container-low">
                <VideoIcon className="h-8 w-8 text-on-surface/30" aria-hidden />
                {v.duracionSegundos != null && (
                  <span className="absolute bottom-3 right-3 rounded-sm bg-background/85 px-2 py-1 text-[10px] text-on-surface">{formatDuration(v.duracionSegundos)}</span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(v.fechaPublica ?? v.fechaIngreso)}</span>
                <h2 className="font-display mt-1 text-lg font-extrabold leading-tight text-on-surface">{v.titulo}</h2>
                <p className="mt-1 text-xs text-on-surface/60">{v.lugar}</p>
                {v.descripcion && <p className="mt-2 text-sm text-on-surface/70">{v.descripcion}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </BitacoraSection>
  );
}
