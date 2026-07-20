import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/fotografias/")({
  head: () => ({
    meta: [
      { title: "Fotografías — Bitácora · rumbo" },
      { name: "description", content: "Cronología visual de la expedición RUMBO por Ecuador." },
    ],
  }),
  component: FotografiasIndex,
});

function FotografiasIndex() {
  const photos = repo.photographs.all();
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const provinces = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => {
      const l = repo.locations.byId(p.locationId);
      if (l) set.add(l.province);
    });
    return Array.from(set).sort();
  }, [photos]);

  const cantons = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => {
      const l = repo.locations.byId(p.locationId);
      if (l && (!province || l.province === province)) set.add(l.canton);
    });
    return Array.from(set).sort();
  }, [photos, province]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = photos.filter((p) => {
      const loc = repo.locations.byId(p.locationId);
      if (query) {
        const hay = `${p.title ?? ""} ${p.description ?? ""} ${loc?.visibleName ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (province && loc?.province !== province) return false;
      if (canton && loc?.canton !== canton) return false;
      if (from && (p.captureDate ?? "") < from) return false;
      if (to && (p.captureDate ?? "") > to) return false;
      return true;
    });
    arr.sort((a, b) => {
      const da = a.captureDate ?? "";
      const db = b.captureDate ?? "";
      return order === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return arr;
  }, [photos, q, province, canton, from, to, order]);

  const clear = () => { setQ(""); setProvince(""); setCanton(""); setFrom(""); setTo(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 01" title="Fotografías" intro="Cronología visual desde las etapas más recientes. Cada imagen conserva su fecha, lugar y coordenadas exactas.">
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
        <Field label="Desde"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguas</option>
          </select>
        </Field>
      </FiltersBar>

      {filtered.length === 0 ? (
        <EmptyResults />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const loc = repo.locations.byId(p.locationId);
            return (
              <Link
                key={p.id}
                to="/bitacora/fotografias/$slug"
                params={{ slug: p.slug }}
                className="group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={p.imageUrl} alt={p.title ?? ""} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(p.captureDate)}</span>
                  {p.title && <h2 className="font-display mt-2 text-lg font-extrabold leading-tight text-on-surface">{p.title}</h2>}
                  <p className="mt-2 text-xs text-on-surface/60">{loc?.visibleName}</p>
                  <p className="text-xs text-on-surface/50">{loc ? `${loc.canton}, ${loc.province}` : ""}</p>


                </div>
              </Link>
            );
          })}
        </div>
      )}
    </BitacoraSection>
  );
}
