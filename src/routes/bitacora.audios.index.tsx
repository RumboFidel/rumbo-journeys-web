import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, formatDuration, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/audios/")({
  head: () => ({
    meta: [
      { title: "Audios — Bitácora · rumbo" },
      { name: "description", content: "Audios originales registrados en la Bitácora de RUMBO." },
    ],
  }),
  component: AudiosIndex,
});

function AudiosIndex() {
  const items = repo.bitacora.byCategoria("audios");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((a) => !query || `${a.titulo ?? ""} ${a.descripcion ?? ""} ${a.lugar ?? ""}`.toLowerCase().includes(query));
    arr.sort((a, b) => {
      const da = a.fechaPublica ?? a.fechaIngreso ?? "";
      const db = b.fechaPublica ?? b.fechaIngreso ?? "";
      return order === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return arr;
  }, [items, q, order]);

  const clear = () => { setQ(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 03" title="Audios" intro="Audios originales cargados por Fidel, registrados en la Bitácora.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option><option value="asc">Más antiguos</option>
          </select>
        </Field>
      </FiltersBar>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-on-surface/50">Todavía no hay audios registrados en la Bitácora.</p>
      ) : filtered.length === 0 ? <EmptyResults /> : (
        <ul className="space-y-4">
          {filtered.map((a) => (
            <li key={a.id} className="border border-outline-variant bg-surface-container-lowest p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(a.fechaPublica ?? a.fechaIngreso)}</span>
                <span className="text-xs text-on-surface/60">{[a.lugar, a.canton, a.provincia].filter(Boolean).join(" · ")}</span>
                {a.duracionSegundos != null && <span className="text-xs text-on-surface/50">{formatDuration(a.duracionSegundos)}</span>}
              </div>
              <Link to="/bitacora/audios/$slug" params={{ slug: a.id }} className="font-display mt-2 block text-lg font-extrabold text-on-surface hover:text-primary">{a.titulo}</Link>
              {a.descripcion && <p className="mt-2 text-sm text-on-surface/70">{a.descripcion}</p>}
              {a.rutaWeb && <audio controls preload="none" className="mt-3 w-full" src={a.rutaWeb} />}
            </li>
          ))}
        </ul>
      )}
    </BitacoraSection>
  );
}
