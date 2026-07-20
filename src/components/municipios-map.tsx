import { useEffect, useRef, useState } from "react";
import type L from "leaflet";

type CantonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { cantonId: string; provincia: string | null; canton: string | null; numCarreras: number };
};

const ECUADOR_CENTER: [number, number] = [-1.5, -78.5];
const ECUADOR_ZOOM = 7;

export function MunicipiosMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [visitados, setVisitados] = useState<CantonFeature[] | null>(null);

  useEffect(() => {
    setReady(true);
    fetch("/data/rumbo/cantones_visitados.geojson")
      .then((r) => r.json())
      .then((geo) => setVisitados(geo?.features ?? []))
      .catch(() => setVisitados([]));
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current || visitados === null) return;
    let cancelled = false;

    (async () => {
      const leaflet = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const map = leaflet.map(containerRef.current, {
        center: ECUADOR_CENTER,
        zoom: ECUADOR_ZOOM,
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

      if (visitados.length > 0) {
        const checkIcon = leaflet.divIcon({
          className: "municipio-check-icon",
          html: `<div class="check-pin"><span>✓</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const bounds = leaflet.latLngBounds([]);
        visitados.forEach((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const marker = leaflet.marker([lat, lng], { icon: checkIcon }).addTo(map);
          marker.bindPopup(
            `<div style="font-family:'Space Grotesk',sans-serif;min-width:160px;">
               <div style="font-size:10px;letter-spacing:0.3em;color:#f5c518;font-weight:700;">${(f.properties.provincia ?? "").toUpperCase()}</div>
               <div style="font-size:16px;font-weight:800;color:#111;margin:4px 0;">${f.properties.canton ?? ""}</div>
               <div style="font-size:11px;color:#666;">${f.properties.numCarreras} carrera${f.properties.numCarreras === 1 ? "" : "s"}</div>
             </div>`,
          );
          bounds.extend([lat, lng]);
        });
        map.fitBounds(bounds.pad(0.15));
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [ready, visitados]);


  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[520px] w-full border border-outline-variant bg-surface-container-lowest md:h-[640px]"
        aria-label="Mapa de Ecuador con los municipios visitados"
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_0_15px_rgba(212,163,77,0.6)]">
            <span className="material-symbols-outlined text-base">check</span>
          </span>
          <span className="text-label-caps text-[10px] tracking-[0.3em] text-on-surface/60">
            MUNICIPIO COMPLETADO
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs text-on-surface/50">
          <span>
            <span className="text-primary font-bold">{visitados?.length ?? 0}</span> / 221 municipios
          </span>
          {visitados && visitados.length > 0 && (
            <span className="hidden md:inline">Toca un pin para ver la etapa</span>
          )}
        </div>
      </div>
    </div>
  );
}
