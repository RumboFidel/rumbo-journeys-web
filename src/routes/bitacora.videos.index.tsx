import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, formatDuration, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/videos/")({
  head: () => ({
    meta: [
      { title: "Videos — Bitácora · rumbo" },
      { name: "description", content: "Testimonios, entrevistas y trazas en video de la expedición RUMBO." },
    ],
  }),
  component: VideosIndex,
});

const TYPE_LABEL: Record<string, string> = { testimonial: "Testimonial", interview: "Entrevista", route: "Ruta", other: "Otro" };

function VideosIndex() {
  const items = repo.videos.all();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const provinces = useMemo(() => Array.from(new Set(items.map((i) => repo.locations.byId(i.locationId)?.province).filter(Boolean))).sort() as string[], [items]);
  const cantons = useMemo(() => Array.from(new Set(items.map((i) => repo.locations.byId(i.locationId)).filter((l) => l && (!province || l.province === province)).map((l) => l!.canton))).sort(), [items, province]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((v) => {
      const loc = repo.locations.byId(v.locationId);
      if (query && !`${v.title} ${v.description ?? ""} ${loc?.visibleName ?? ""}`.toLowerCase().includes(query)) return false;
      if (type && v.videoType !== type) return false;
      if (province && loc?.province !== province) return false;
      if (canton && loc?.canton !== canton) return false;
      if (from && (v.captureDate ?? "") < from) return false;
      if (to && (v.captureDate ?? "") > to) return false;
      return true;
    });
    arr.sort((a, b) => order === "desc" ? (b.captureDate ?? "").localeCompare(a.captureDate ?? "") : (a.captureDate ?? "").localeCompare(b.captureDate ?? ""));
    return arr;
  }, [items, q, type, province, canton, from, to, order]);

  const clear = () => { setQ(""); setType(""); setProvince(""); setCanton(""); setFrom(""); setTo(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 04" title="Videos" intro="Testimonios cortos, entrevistas y planos de las rutas recorridas.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Tipo">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            <option value="testimonial">Testimonial</option>
            <option value="interview">Entrevista</option>
            <option value="route">Ruta</option>
            <option value="other">Otro</option>
          </select>
        </Field>
        <Field label="Provincia">
          <select className={inputCls} value={province} onChange={(e) => { setProvince(e.target.value); setCanton(""); }}>
            <option value="">Todas</option>{provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Cantón">
          <select className={inputCls} value={canton} onChange={(e) => setCanton(e.target.value)}>
            <option value="">Todos</option>{cantons.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Desde"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option><option value="asc">Más antiguos</option>
          </select>
        </Field>
      </FiltersBar>

      {filtered.length === 0 ? <EmptyResults /> : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const loc = repo.locations.byId(v.locationId);
            return (
              <Link key={v.id} to="/bitacora/videos/$slug" params={{ slug: v.slug }} className="group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60">
                <div className="relative aspect-video overflow-hidden">
                  <img src={v.coverUrl} alt={v.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <span className="text-label-caps absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 text-[9px] tracking-[0.3em] text-primary">{TYPE_LABEL[v.videoType].toUpperCase()}</span>
                  <span className="absolute bottom-3 right-3 rounded-sm bg-background/85 px-2 py-1 text-[10px] text-on-surface">{formatDuration(v.durationSeconds)}</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(v.captureDate)}</span>
                  <h2 className="font-display mt-1 text-lg font-extrabold leading-tight text-on-surface">{v.title}</h2>
                  <p className="mt-1 text-xs text-on-surface/60">{loc?.visibleName}</p>
                  {v.description && <p className="mt-2 text-sm text-on-surface/70">{v.description}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </BitacoraSection>
  );
}
