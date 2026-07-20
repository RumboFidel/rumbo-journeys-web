import { useEffect, useRef, useState } from "react";
import type L from "leaflet";


type Municipio = {
  name: string;
  province: string;
  lat: number;
  lng: number;
  date?: string;
};

// Muestra representativa de los 37 municipios ya recorridos
const VISITED: Municipio[] = [
  { name: "Quito", province: "Pichincha", lat: -0.1807, lng: -78.4678, date: "01 MAR" },
  { name: "Cayambe", province: "Pichincha", lat: 0.0402, lng: -78.1461, date: "04 MAR" },
  { name: "Otavalo", province: "Imbabura", lat: 0.2333, lng: -78.2615, date: "07 MAR" },
  { name: "Ibarra", province: "Imbabura", lat: 0.3517, lng: -78.1223, date: "09 MAR" },
  { name: "Tulcán", province: "Carchi", lat: 0.8121, lng: -77.7181, date: "12 MAR" },
  { name: "Latacunga", province: "Cotopaxi", lat: -0.9333, lng: -78.6167, date: "17 MAR" },
  { name: "Ambato", province: "Tungurahua", lat: -1.2543, lng: -78.6229, date: "21 MAR" },
  { name: "Baños", province: "Tungurahua", lat: -1.3928, lng: -78.4247, date: "23 MAR" },
  { name: "Riobamba", province: "Chimborazo", lat: -1.6635, lng: -78.6547, date: "27 MAR" },
  { name: "Guaranda", province: "Bolívar", lat: -1.5906, lng: -79.0006, date: "30 MAR" },
  { name: "Alausí", province: "Chimborazo", lat: -2.1997, lng: -78.8447, date: "02 ABR" },
  { name: "Cuenca", province: "Azuay", lat: -2.9006, lng: -79.0045, date: "07 ABR" },
  { name: "Gualaceo", province: "Azuay", lat: -2.8942, lng: -78.7783, date: "09 ABR" },
  { name: "Azogues", province: "Cañar", lat: -2.7397, lng: -78.8489, date: "11 ABR" },
  { name: "Cañar", province: "Cañar", lat: -2.5544, lng: -78.9375, date: "13 ABR" },
  { name: "Loja", province: "Loja", lat: -3.9931, lng: -79.2042, date: "18 ABR" },
  { name: "Vilcabamba", province: "Loja", lat: -4.2611, lng: -79.2244, date: "20 ABR" },
  { name: "Catamayo", province: "Loja", lat: -3.9836, lng: -79.3572, date: "22 ABR" },
  { name: "Machala", province: "El Oro", lat: -3.2581, lng: -79.9553, date: "27 ABR" },
  { name: "Zaruma", province: "El Oro", lat: -3.6928, lng: -79.6136, date: "29 ABR" },
  { name: "Santa Rosa", province: "El Oro", lat: -3.4525, lng: -79.9611, date: "01 MAY" },
  { name: "Guayaquil", province: "Guayas", lat: -2.1709, lng: -79.9224, date: "05 MAY" },
  { name: "Milagro", province: "Guayas", lat: -2.1342, lng: -79.5872, date: "08 MAY" },
  { name: "Daule", province: "Guayas", lat: -1.8611, lng: -79.9769, date: "10 MAY" },
  { name: "Playas", province: "Guayas", lat: -2.6300, lng: -80.3897, date: "13 MAY" },
  { name: "Santa Elena", province: "Santa Elena", lat: -2.2267, lng: -80.8583, date: "15 MAY" },
  { name: "Salinas", province: "Santa Elena", lat: -2.2144, lng: -80.9583, date: "16 MAY" },
  { name: "Manta", province: "Manabí", lat: -0.9678, lng: -80.7089, date: "19 MAY" },
  { name: "Portoviejo", province: "Manabí", lat: -1.0561, lng: -80.4547, date: "21 MAY" },
  { name: "Bahía", province: "Manabí", lat: -0.5983, lng: -80.4239, date: "24 MAY" },
  { name: "Chone", province: "Manabí", lat: -0.6961, lng: -80.0942, date: "26 MAY" },
  { name: "Santo Domingo", province: "Sto. Domingo", lat: -0.2542, lng: -79.1719, date: "29 MAY" },
  { name: "Esmeraldas", province: "Esmeraldas", lat: 0.9539, lng: -79.6553, date: "02 JUN" },
  { name: "Atacames", province: "Esmeraldas", lat: 0.8636, lng: -79.8419, date: "04 JUN" },
  { name: "Tena", province: "Napo", lat: -0.9931, lng: -77.8153, date: "08 JUN" },
  { name: "Puyo", province: "Pastaza", lat: -1.4831, lng: -77.9942, date: "11 JUN" },
  { name: "Macas", province: "Morona Santiago", lat: -2.3106, lng: -78.1250, date: "14 JUN" },
];

export function MunicipiosMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const leaflet = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const map = leaflet.map(containerRef.current, {
        center: [-1.5, -78.5],
        zoom: 7,
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

      const checkIcon = leaflet.divIcon({
        className: "municipio-check-icon",
        html: `<div class="check-pin"><span>✓</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const bounds = leaflet.latLngBounds([]);
      VISITED.forEach((m) => {
        const marker = leaflet.marker([m.lat, m.lng], { icon: checkIcon }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:'Space Grotesk',sans-serif;min-width:160px;">
             <div style="font-size:10px;letter-spacing:0.3em;color:#f5c518;font-weight:700;">${m.province.toUpperCase()}</div>
             <div style="font-size:16px;font-weight:800;color:#111;margin:4px 0;">${m.name}</div>
             <div style="font-size:11px;color:#666;">Etapa completada · ${m.date ?? ""}</div>
           </div>`,
        );
        bounds.extend([m.lat, m.lng]);
      });

      map.fitBounds(bounds.pad(0.15));
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [ready]);


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
            <span className="text-primary font-bold">{VISITED.length}</span> / 221 municipios
          </span>
          <span className="hidden md:inline">Toca un pin para ver la etapa</span>
        </div>
      </div>
    </div>
  );
}
