import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, Field, FiltersBar, formatDate, formatDuration, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";
import { Eye, EyeOff, Map } from "lucide-react";

export const Route = createFileRoute("/bitacora/rutas-gpx")({
  head: () => ({
    meta: [
      { title: "Rutas GPX — Bitácora · rumbo" },
      { name: "description", content: "Trazas GPX de las etapas de la expedición RUMBO por Ecuador." },
    ],
  }),
  component: RutasGpxPage,
});

function RutasGpxPage() {
  const all = repo.gpxRoutes.all();
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(all.map((r) => [r.id, r.routeStatus === "active"]))
  );

  const provinces = useMemo(() => Array.from(new Set(all.map((r) => repo.locations.byId(r.locationId)?.province).filter(Boolean))).sort() as string[], [all]);
  const cantons = useMemo(() => Array.from(new Set(all.map((r) => repo.locations.byId(r.locationId)).filter((l) => l && (!province || l.province === province)).map((l) => l!.canton))).sort(), [all, province]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((r) => {
      const loc = repo.locations.byId(r.locationId);
      if (query && !`${r.title} ${loc?.visibleName ?? ""}`.toLowerCase().includes(query)) return false;
      if (province && loc?.province !== province) return false;
      if (canton && loc?.canton !== canton) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }, [all, q, province, canton, from, to]);

  const clear = () => { setQ(""); setProvince(""); setCanton(""); setFrom(""); setTo(""); };
  const showAll = () => setActive(Object.fromEntries(all.map((r) => [r.id, true])));
  const hideAll = () => setActive(Object.fromEntries(all.map((r) => [r.id, false])));
  const toggle = (id: string) => setActive((s) => ({ ...s, [id]: !s[id] }));

  const activeCount = filtered.filter((r) => active[r.id]).length;

  return (
    <BitacoraSection eyebrow="BITÁCORA · 05" title="Rutas GPX" intro="Un mapa con las trazas de cada etapa. El visor cartográfico se integrará en la siguiente fase; mientras tanto, el panel funciona para explorar y activar rutas.">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="relative flex aspect-[4/3] flex-col items-center justify-center border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center lg:aspect-auto lg:h-full">
            <Map className="mb-4 h-10 w-10 text-primary/60" aria-hidden />
            <p className="text-label-caps text-[10px] tracking-[0.4em] text-primary">VISOR DE RUTAS</p>
            <p className="mt-3 max-w-sm text-sm text-on-surface/60">Espacio reservado para el mapa interactivo con las trazas GPX. Se conectará posteriormente sin cambiar este layout.</p>
            <p className="mt-2 text-xs text-on-surface/50">{activeCount} de {filtered.length} rutas activas</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <FiltersBar onClear={clear}>
            <Field label="Buscar"><input className={inputCls} placeholder="Nombre de la ruta" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
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
          </FiltersBar>

          <div className="mb-3 flex gap-2">
            <button onClick={showAll} className="text-label-caps flex-1 border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface hover:border-primary/60 hover:text-primary">MOSTRAR TODAS</button>
            <button onClick={hideAll} className="text-label-caps flex-1 border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface hover:border-primary/60 hover:text-primary">OCULTAR TODAS</button>
          </div>

          <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest">
            {filtered.map((r) => {
              const loc = repo.locations.byId(r.locationId);
              const on = !!active[r.id];
              return (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-sm font-extrabold text-on-surface">{r.title}</p>
                      <p className="text-label-caps mt-1 text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(r.date)}</p>
                      <p className="mt-1 text-xs text-on-surface/60">{loc ? `${loc.canton}, ${loc.province}` : ""}</p>
                      <p className="mt-1 text-xs text-on-surface/70">
                        {r.distanceKm.toFixed(1)} km
                        {r.durationSeconds ? ` · ${formatDuration(r.durationSeconds)}` : ""}
                        {r.elevationGain ? ` · +${r.elevationGain} m` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => toggle(r.id)}
                      aria-pressed={on}
                      aria-label={on ? "Desactivar ruta" : "Activar ruta"}
                      className={`flex flex-shrink-0 items-center gap-1 border px-3 py-2 text-[10px] tracking-[0.3em] transition ${on ? "border-primary text-primary" : "border-outline-variant text-on-surface/60 hover:text-primary"}`}
                    >
                      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {on ? "ACTIVA" : "OCULTA"}
                    </button>
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-6 text-center text-sm text-on-surface/60">Sin rutas con estos filtros.</li>
            )}
          </ul>
        </div>
      </div>
    </BitacoraSection>
  );
}
