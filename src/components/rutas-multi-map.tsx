import { useEffect, useRef, useState } from "react";
import type L from "leaflet";

const PALETTE = [
  "#f5c518", "#4fd1c5", "#f56565", "#63b3ed",
  "#ed64a6", "#68d391", "#f6ad55", "#9f7aea",
];

export type RutaMapaItem = {
  id: string;
  geojsonUrl: string;
  active: boolean;
};

/**
 * Visor cartografico de multiples rutas simultaneas. Cada ruta activa se
 * dibuja con su propio color estable (por indice en la lista completa, no
 * en la lista de activas, para que un color no "salte" al des/activar
 * otras rutas). El mapa se reencuadra a la union de las rutas activas cada
 * vez que cambia el conjunto activo.
 */
export function RutasMultiMap({
  routes,
  onErrorIdsChange,
}: {
  routes: RutaMapaItem[];
  onErrorIdsChange?: (ids: Set<string>) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const layersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const geojsonCacheRef = useRef<Map<string, unknown>>(new Map());
  const [ready, setReady] = useState(false);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    onErrorIdsChange?.(errorIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorIds]);

  const colorFor = (id: string) => {
    const idx = routes.findIndex((r) => r.id === id);
    return PALETTE[idx % PALETTE.length] ?? PALETTE[0];
  };

  // Crear el mapa una sola vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = leaflet.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      map.setView([-1.5, -78.5], 6);

      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        })
        .addTo(map);

      mapRef.current = map;
      leafletRef.current = leaflet;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current.clear();
    };
  }, []);

  // Sincronizar capas activas cada vez que cambia la seleccion.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    let cancelled = false;

    const activeIds = new Set(routes.filter((r) => r.active).map((r) => r.id));

    // Quitar capas de rutas que ya no estan activas.
    for (const [id, layer] of layersRef.current) {
      if (!activeIds.has(id)) {
        map.removeLayer(layer);
        layersRef.current.delete(id);
      }
    }

    const refitBounds = () => {
      const active = [...layersRef.current.values()];
      if (active.length === 0) return;
      const bounds = leaflet.latLngBounds([]);
      for (const layer of active) bounds.extend(layer.getBounds());
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.1));
    };

    (async () => {
      for (const route of routes) {
        if (!route.active || layersRef.current.has(route.id)) continue;
        try {
          let geo = geojsonCacheRef.current.get(route.geojsonUrl);
          if (!geo) {
            const res = await fetch(route.geojsonUrl);
            if (!res.ok) throw new Error(`GeoJSON ${res.status}`);
            geo = await res.json();
            geojsonCacheRef.current.set(route.geojsonUrl, geo);
          }
          if (cancelled || !route.active) continue;
          const layer = leaflet
            .geoJSON(geo as Parameters<typeof leaflet.geoJSON>[0], {
              style: { color: colorFor(route.id), weight: 4, opacity: 0.9 },
            })
            .addTo(map);
          layersRef.current.set(route.id, layer);
          setErrorIds((prev) => {
            if (!prev.has(route.id)) return prev;
            const next = new Set(prev);
            next.delete(route.id);
            return next;
          });
        } catch {
          if (!cancelled) setErrorIds((prev) => new Set(prev).add(route.id));
        }
      }
      if (!cancelled) refitBounds();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routes.map((r) => `${r.id}:${r.active}`).join(",")]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Mapa de rutas registradas en la Bitácora"
    />
  );
}
