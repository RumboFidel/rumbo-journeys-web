import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, formatDuration, inputCls } from "@/components/bitacora-shell";
import { RutasMultiMap, type RutaMapaItem } from "@/components/rutas-multi-map";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/bitacora/rutas-gpx")({
  head: () => ({
    meta: [
      { title: "Rutas — Bitácora · rumbo" },
      { name: "description", content: "Actividades de ruta (FIT, GPX o TCX) originales registradas en la Bitácora de RUMBO." },
    ],
  }),
  component: RutasIndex,
});

const PALETTE = [
  "#f5c518", "#4fd1c5", "#f56565", "#63b3ed",
  "#ed64a6", "#68d391", "#f6ad55", "#9f7aea",
];

function RutasIndex() {
  const items = repo.bitacora.byCategoria("rutas");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [activeIds, setActiveIds] = useState<Set<string> | null>(null);
  const [mapErrorIds, setMapErrorIds] = useState<Set<string>>(new Set());

  // Por defecto, mostrar en el mapa todas las rutas que tengan un GeoJSON
  // disponible. Se inicializa una sola vez (cuando llegan los items reales),
  // sin sobreescribir la seleccion manual del usuario en renders siguientes.
  useEffect(() => {
    if (activeIds !== null) return;
    const conGeojson = items.filter((r) => r.rutaGeojson).map((r) => r.id);
    if (conGeojson.length > 0) setActiveIds(new Set(conGeojson));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = items.filter((r) => !query || `${r.titulo ?? ""} ${r.lugar ?? ""}`.toLowerCase().includes(query));
    arr.sort((a, b) => {
      const da = a.fechaCaptura ?? a.fechaIngreso ?? "";
      const db = b.fechaCaptura ?? b.fechaIngreso ?? "";
      return order === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return arr;
  }, [items, q, order]);

  const clear = () => { setQ(""); setOrder("desc"); };

  const mapRoutes: RutaMapaItem[] = items
    .filter((r) => r.rutaGeojson)
    .map((r) => ({ id: r.id, geojsonUrl: r.rutaGeojson as string, active: activeIds?.has(r.id) ?? false }));

  const colorFor = (id: string) => {
    const idx = mapRoutes.findIndex((r) => r.id === id);
    return idx >= 0 ? PALETTE[idx % PALETTE.length] : null;
  };

  const toggle = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 05" title="Rutas" intro="Actividades de ruta originales (FIT, GPX o TCX) cargadas por Fidel, registradas en la Bitácora. Activa una o varias para verlas juntas en el mapa.">
      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-on-surface/50">Todavía no hay rutas registradas en la Bitácora.</p>
      ) : (
        <>
          {mapRoutes.length > 0 ? (
            <div className="mb-8 h-[420px] w-full overflow-hidden border border-outline-variant bg-surface-container-lowest">
              <RutasMultiMap routes={mapRoutes} onErrorIdsChange={setMapErrorIds} />
            </div>
          ) : (
            <div className="mb-8 border border-dashed border-outline-variant p-10 text-center text-sm text-on-surface/50">
              Ninguna de las rutas registradas tiene todavía un recorrido (GeoJSON) disponible para el mapa.
            </div>
          )}

          <FiltersBar onClear={clear}>
            <Field label="Buscar"><input className={inputCls} placeholder="Nombre o lugar" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
            <Field label="Orden">
              <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
                <option value="desc">Más recientes</option><option value="asc">Más antiguas</option>
              </select>
            </Field>
          </FiltersBar>

          {filtered.length === 0 ? <EmptyResults /> : (
            <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest">
              {filtered.map((r) => {
                const formato = (r.nombre?.split(".").pop() ?? "").toUpperCase();
                const color = r.rutaGeojson ? colorFor(r.id) : null;
                const isActive = activeIds?.has(r.id) ?? false;
                const failedOnMap = mapErrorIds.has(r.id);
                return (
                  <li key={r.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {r.rutaGeojson ? (
                        <label className="mt-1 flex flex-shrink-0 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => toggle(r.id)}
                            className="h-4 w-4 accent-primary"
                            aria-label={`Mostrar en el mapa: ${r.titulo}`}
                          />
                          {color && (
                            <span
                              className="h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: isActive ? color : "transparent", border: `2px solid ${color}` }}
                              aria-hidden
                            />
                          )}
                        </label>
                      ) : (
                        <span className="mt-1 h-4 w-4 flex-shrink-0" aria-hidden />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {formato && <span className="text-label-caps text-[9px] tracking-[0.3em] text-primary">{formato}</span>}
                          <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(r.fechaCaptura ?? r.fechaIngreso)}</span>
                        </div>
                        <p className="font-display truncate text-sm font-extrabold text-on-surface">{r.titulo}</p>
                        <p className="mt-1 text-xs text-on-surface/60">{[r.lugar, r.canton, r.provincia].filter(Boolean).join(", ")}</p>
                        {r.duracionSegundos ? <p className="mt-1 text-xs text-on-surface/70">{formatDuration(r.duracionSegundos)}</p> : null}
                        {!r.rutaGeojson && (
                          <p className="mt-1 text-xs text-on-surface/40">Sin recorrido geográfico disponible todavía.</p>
                        )}
                        {failedOnMap && (
                          <p className="mt-1 text-xs text-red-400">No se pudo cargar este recorrido en el mapa.</p>
                        )}
                      </div>

                      <div className="flex flex-shrink-0 flex-col items-end gap-2">
                        {r.rutaWeb && (
                          <a
                            href={r.rutaWeb}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-label-caps border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface hover:border-primary/60 hover:text-primary"
                          >
                            DESCARGAR ORIGINAL
                          </a>
                        )}
                        {r.rutaGeojson && (
                          <a
                            href={r.rutaGeojson}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-label-caps border border-outline-variant px-3 py-2 text-[10px] tracking-[0.3em] text-on-surface hover:border-primary/60 hover:text-primary"
                          >
                            DESCARGAR GEOJSON
                          </a>
                        )}
                      </div>
                    </div>
                    {r.derivados.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 pl-7">
                        {r.derivados.map((d, i) => (
                          <span key={i} className="text-label-caps border border-outline-variant/60 px-2 py-1 text-[9px] tracking-[0.2em] text-on-surface/50">
                            {d.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </BitacoraSection>
  );
}
