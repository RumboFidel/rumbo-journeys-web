import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/cuadernos-documentos/")({
  head: () => ({
    meta: [
      { title: "Cuadernos y documentos — Bitácora · rumbo" },
      { name: "description", content: "Cuadernos escaneados, permisos y prensa de la expedición RUMBO." },
    ],
  }),
  component: NotebooksIndex,
});

function NotebooksIndex() {
  const items = repo.notebooksDocuments.all();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "notebook" | "document">("all");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const provinces = useMemo(() => Array.from(new Set(items.map((i) => repo.locations.byId(i.locationId)?.province).filter(Boolean))).sort() as string[], [items]);
  const cantons = useMemo(() => Array.from(new Set(items.map((i) => repo.locations.byId(i.locationId)).filter((l) => l && (!province || l.province === province)).map((l) => l!.canton))).sort(), [items, province]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((n) => {
      const loc = repo.locations.byId(n.locationId);
      if (query && !`${n.title} ${n.description ?? ""} ${loc?.visibleName ?? ""}`.toLowerCase().includes(query)) return false;
      if (kind !== "all" && n.kind !== kind) return false;
      if (province && loc?.province !== province) return false;
      if (canton && loc?.canton !== canton) return false;
      if (from && (n.captureDate ?? "") < from) return false;
      if (to && (n.captureDate ?? "") > to) return false;
      return true;
    });
    arr.sort((a, b) => order === "desc" ? (b.captureDate ?? "").localeCompare(a.captureDate ?? "") : (a.captureDate ?? "").localeCompare(b.captureDate ?? ""));
    return arr;
  }, [items, q, kind, province, canton, from, to, order]);

  const clear = () => { setQ(""); setKind("all"); setProvince(""); setCanton(""); setFrom(""); setTo(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 02" title="Cuadernos y documentos" intro="Páginas manuscritas escaneadas, permisos oficiales y recortes de prensa. Cada cuaderno es un PDF de páginas escaneadas.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Tipo">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="notebook">Cuadernos</option>
            <option value="document">Documentos</option>
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
        <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest">
          {filtered.map((n) => {
            const loc = repo.locations.byId(n.locationId);
            return (
              <li key={n.id}>
                <Link to="/bitacora/cuadernos-documentos/$slug" params={{ slug: n.slug }} className="flex flex-col gap-3 p-5 transition hover:bg-background md:flex-row md:items-center md:gap-6">
                  <div className="md:w-40 md:flex-shrink-0">
                    {n.coverUrl && <img src={n.coverUrl} alt="" className="aspect-[4/3] w-full object-cover md:h-24" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-label-caps text-[9px] tracking-[0.3em] text-primary">{n.kind === "notebook" ? "CUADERNO" : "DOCUMENTO"}</span>
                      <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(n.captureDate)}</span>
                    </div>
                    <h2 className="font-display mt-1 text-lg font-extrabold leading-tight text-on-surface">{n.title}</h2>
                    <p className="mt-1 text-xs text-on-surface/60">{loc ? `${loc.visibleName} · ${loc.canton}, ${loc.province}` : ""}</p>
                    {n.description && <p className="mt-2 text-sm text-on-surface/70">{n.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-on-surface/50">
                      <span>Formato: {n.format.toUpperCase()}</span>
                      {n.pageCount && <span>{n.pageCount} páginas</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BitacoraSection>
  );
}
