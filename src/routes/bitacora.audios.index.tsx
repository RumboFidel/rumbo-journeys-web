import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, formatDuration, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/audios/")({
  head: () => ({
    meta: [
      { title: "Audios — Bitácora · rumbo" },
      { name: "description", content: "Voces, vientos y conversaciones registradas durante la expedición RUMBO." },
    ],
  }),
  component: AudiosIndex,
});

function AudiosIndex() {
  const items = repo.audios.all();
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const provinces = useMemo(() => Array.from(new Set(items.map((i) => repo.locations.byId(i.locationId)?.province).filter(Boolean))).sort() as string[], [items]);
  const cantons = useMemo(() => Array.from(new Set(items.map((i) => repo.locations.byId(i.locationId)).filter((l) => l && (!province || l.province === province)).map((l) => l!.canton))).sort(), [items, province]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((a) => {
      const loc = repo.locations.byId(a.locationId);
      if (query && !`${a.title} ${a.description ?? ""} ${loc?.visibleName ?? ""}`.toLowerCase().includes(query)) return false;
      if (province && loc?.province !== province) return false;
      if (canton && loc?.canton !== canton) return false;
      if (from && (a.captureDate ?? "") < from) return false;
      if (to && (a.captureDate ?? "") > to) return false;
      return true;
    });
    arr.sort((a, b) => order === "desc" ? (b.captureDate ?? "").localeCompare(a.captureDate ?? "") : (a.captureDate ?? "").localeCompare(b.captureDate ?? ""));
    return arr;
  }, [items, q, province, canton, from, to, order]);

  const clear = () => { setQ(""); setProvince(""); setCanton(""); setFrom(""); setTo(""); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 03" title="Audios" intro="Escuchas breves grabadas al paso: vientos, mercados, olas y conversaciones espontáneas.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Título o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
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
        <ul className="space-y-4">
          {filtered.map((a) => {
            const loc = repo.locations.byId(a.locationId);
            const rels = repo.relations.forAsset("audio", a.id);
            return (
              <li key={a.id} className="border border-outline-variant bg-surface-container-lowest p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(a.captureDate)}</span>
                  <span className="text-xs text-on-surface/60">{loc ? `${loc.visibleName} · ${loc.canton}, ${loc.province}` : ""}</span>
                  <span className="text-xs text-on-surface/50">{formatDuration(a.durationSeconds)}</span>
                </div>
                <Link to="/bitacora/audios/$slug" params={{ slug: a.slug }} className="font-display mt-2 block text-lg font-extrabold text-on-surface hover:text-primary">{a.title}</Link>
                {a.description && <p className="mt-2 text-sm text-on-surface/70">{a.description}</p>}
                <audio controls preload="none" className="mt-3 w-full" src={a.audioUrl} />
                {rels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    {rels.map((r) => {
                      if (r.destinationType === "race") {
                        const race = repo.races.byId(r.destinationId);
                        return race ? <Link key={r.id} to="/carreras" className="text-label-caps border border-outline-variant px-2 py-1 tracking-[0.3em] text-on-surface hover:text-primary">CARRERA · {race.title}</Link> : null;
                      }
                      if (r.destinationType === "story") {
                        const st = repo.stories.byId(r.destinationId);
                        return st ? <Link key={r.id} to="/historias" className="text-label-caps border border-outline-variant px-2 py-1 tracking-[0.3em] text-on-surface hover:text-primary">HISTORIA · {st.title}</Link> : null;
                      }
                      return null;
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </BitacoraSection>
  );
}
