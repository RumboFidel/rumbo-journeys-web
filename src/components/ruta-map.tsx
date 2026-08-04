import { useEffect, useRef, useState } from "react";
import type L from "leaflet";

/** Visor de una traza GeoJSON (LineString) individual de una Ruta/Carrera. */
export function RutaMap({ geojsonUrl }: { geojsonUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const [leaflet, res] = await Promise.all([
          import("leaflet").then((m) => m.default),
          fetch(geojsonUrl),
        ]);
        await import("leaflet/dist/leaflet.css");
        if (!res.ok) throw new Error(`GeoJSON ${res.status}`);
        const geo = await res.json();
        if (cancelled || !containerRef.current) return;

        const map = leaflet.map(containerRef.current, {
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true,
        });
        mapRef.current = map;

        leaflet
          .tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
          })
          .addTo(map);

        const layer = leaflet
          .geoJSON(geo, {
            style: { color: "#f5c518", weight: 4, opacity: 0.9 },
          })
          .addTo(map);

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.1));
        } else {
          map.setView([-1.5, -78.5], 6);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [ready, geojsonUrl]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-outline-variant bg-background text-sm text-on-surface/50">
        No se pudo cargar el recorrido.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Mapa del recorrido de la Carrera"
    />
  );
}
