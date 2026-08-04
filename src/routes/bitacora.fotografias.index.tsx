import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/fotografias/")({
  head: () => ({
    meta: [
      { title: "Fotografías — Bitácora · rumbo" },
      { name: "description", content: "Fotografías originales registradas en la Bitácora de RUMBO." },
    ],
  }),
  component: FotografiasIndex,
});

function FotografiasIndex() {
  const items = repo.bitacora.byCategoria("fotografias");
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const provinces = useMemo(() => Array.from(new Set(items.map((i) => i.provincia).filter(Boolean))).sort() as string[], [items]);
  const cantons = useMemo(() => Array.from(new Set(items.filter((i) => !province || i.provincia === province).map((i) => i.canton).filter(Boolean))).sort() as string[], [items, province]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((p) => {
      if (query && !`${p.titulo ?? ""} ${p.descripcion ?? ""} ${p.lugar ?? ""}`.toLowerCase().includes(query)) return false;
      if (province && p.provincia !== province) return false;
      if (canton && p.canton !== canton) return false;
      return true;
    });
    arr.sort((a, b) => {
      const da = a.fechaPublica ?? a.fechaIngreso ?? "";
      const db = b.fechaPublica ?? b.fechaIngreso ?? "";
      return order === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return arr;
  }, [items, q, province, canton, order]);

  const clear = () => { setQ(""); setProvince(""); setCanton(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 01" title="Fotografías" intro="Cronología visual de los archivos originales cargados por Fidel.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título, descripción o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Provincia">
          <select className={inputCls} value={province} onChange={(e) => { setProvince(e.target.value); setCanton(""); }}>
            <option value="">Todas</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Cantón">
          <select className={inputCls} value={canton} onChange={(e) => setCanton(e.target.value)}>
            <option value="">Todos</option>
            {cantons.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguas</option>
          </select>
        </Field>
      </FiltersBar>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-on-surface/50">
          Todavía no hay fotografías registradas en la Bitácora.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyResults />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/bitacora/fotografias/$slug"
              params={{ slug: p.id }}
              className="group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
                {p.rutaWeb ? (
                  <img src={p.rutaWeb} alt={p.titulo ?? ""} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-on-surface/40">Sin imagen</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(p.fechaPublica ?? p.fechaIngreso)}</span>
                {p.titulo && <h2 className="font-display mt-2 text-lg font-extrabold leading-tight text-on-surface">{p.titulo}</h2>}
                <p className="mt-2 text-xs text-on-surface/60">{p.lugar}</p>
                <p className="text-xs text-on-surface/50">{[p.canton, p.provincia].filter(Boolean).join(", ")}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BitacoraSection>
  );
}
