import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import raceQuito from "@/assets/race-quito.jpg.asset.json";
import raceCuenca from "@/assets/race-cuenca.jpg.asset.json";
import storyCotopaxi from "@/assets/story-cotopaxi.jpg.asset.json";
import storySabiduria from "@/assets/story-sabiduria.jpg.asset.json";

export const Route = createFileRoute("/carreras")({
  head: () => ({
    meta: [
      { title: "CARRERAS — rumbo" },
      {
        name: "description",
        content:
          "Mundo 01 · CARRERAS. Ecuador municipio a municipio: provincias, cantones y bitácoras del recorrido.",
      },
    ],
  }),
  component: CarrerasPage,
});

const TOTAL_CANTONES = 221;

type Carrera = {
  slug: string;
  n: number;
  municipio: string;
  provincia: string;
  title: string;
  date: string;
  desc: string;
  photos: string[];
  videoUrl?: string;
  tags: { label: string; to: "/historias" | "/bitacora" }[];
};

// Estructura geográfica (ejemplo con 4 provincias). Reemplazar por la lista
// completa de 24 provincias y sus 221 cantones cuando esté disponible.
const PROVINCIAS: Record<string, string[]> = {
  Azuay: ["Cuenca", "Girón", "Gualaceo", "Nabón", "Paute", "Santa Isabel"],
  Guayas: [
    "Daule",
    "Durán",
    "El Empalme",
    "Guayaquil",
    "Milagro",
    "Playas",
    "Samborondón",
  ],
  Loja: ["Catamayo", "Loja", "Macará", "Saraguro", "Zapotillo"],
  Pichincha: [
    "Cayambe",
    "Mejía",
    "Pedro Moncayo",
    "Puerto Quito",
    "Quito",
    "Rumiñahui",
    "San Miguel de los Bancos",
  ],
};

// Mock — reemplazar por lectura de la hoja "Carreras" de Google Sheets.
const CARRERAS: Carrera[] = [
  {
    slug: "guayaquil",
    n: 1,
    municipio: "Guayaquil",
    provincia: "Guayas",
    title: "Guayaquil: el lujo de recorrer Las Peñas y el Malecón",
    date: "2026-06-12",
    desc:
      "Diez kilómetros a orillas del Guayas, subiendo los 444 escalones de Las Peñas al amanecer, entre el color de las casas y el bullicio del puerto que despierta.",
    photos: [raceQuito.url, raceCuenca.url, storyCotopaxi.url],
    tags: [
      { label: "Historia: Las Peñas", to: "/historias" },
      { label: "Bitácora del día", to: "/bitacora" },
    ],
  },
  {
    slug: "cuenca",
    n: 2,
    municipio: "Cuenca",
    provincia: "Azuay",
    title: "Cuenca — Puentes de piedra y adoquines coloniales",
    date: "2026-06-18",
    desc:
      "Un recorrido por el centro patrimonial cruzando el Tomebamba, con el Cajas custodiando el horizonte al atardecer.",
    photos: [raceCuenca.url, storySabiduria.url],
    tags: [
      { label: "Historia: El Cajas", to: "/historias" },
      { label: "Bitácora del día", to: "/bitacora" },
    ],
  },
  {
    slug: "quito",
    n: 3,
    municipio: "Quito",
    provincia: "Pichincha",
    title: "Quito — Amanecer en el páramo",
    date: "2026-06-25",
    desc:
      "Salida antes del alba desde la Mitad del Mundo, cruzando la neblina que abraza el altiplano andino.",
    photos: [raceQuito.url, storyCotopaxi.url, storySabiduria.url],
    tags: [
      { label: "Historia: Mitad del Mundo", to: "/historias" },
      { label: "Bitácora del día", to: "/bitacora" },
    ],
  },
];

function key(prov: string, muni: string) {
  return `${prov}::${muni}`.toLowerCase();
}

function CarrerasPage() {
  const carrerasByMuni = useMemo(() => {
    const map = new Map<string, Carrera>();
    for (const c of CARRERAS) map.set(key(c.provincia, c.municipio), c);
    return map;
  }, []);

  const provincias = useMemo(() => Object.keys(PROVINCIAS).sort(), []);
  const [openProv, setOpenProv] = useState<string | null>(provincias[0] ?? null);
  const [openMuni, setOpenMuni] = useState<string | null>(null);

  const totalHechas = CARRERAS.length;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />

      <main className="pt-24">
        <section className="mx-auto max-w-5xl px-6 py-12 md:px-16 md:py-20">
          <div className="mb-10 flex flex-col items-center text-center md:mb-14">
            <span className="text-label-caps mb-4 text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              MUNDO 01
            </span>
            <h1 className="font-display text-4xl font-extrabold text-on-surface md:text-6xl">
              CARRERAS
            </h1>
            <p className="font-serif mt-6 max-w-2xl text-base leading-relaxed text-on-surface/60">
              Ecuador cantón a cantón. Elige una provincia y despliega sus
              municipios para ver los recorridos completados.
            </p>

            <div className="mt-8 inline-flex items-baseline gap-3 border border-primary/40 px-6 py-3">
              <span className="font-display text-3xl font-extrabold text-primary md:text-4xl">
                {totalHechas}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-on-surface/60">
                / {TOTAL_CANTONES} cantones
              </span>
            </div>
          </div>

          <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest">
            {provincias.map((prov) => {
              const munis = [...PROVINCIAS[prov]].sort((a, b) => a.localeCompare(b));
              const hechas = munis.filter((m) => carrerasByMuni.has(key(prov, m))).length;
              const isOpen = openProv === prov;
              return (
                <li key={prov}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenProv(isOpen ? null : prov);
                      setOpenMuni(null);
                    }}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/5 md:px-8 md:py-5"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        aria-hidden
                        className={`font-mono text-lg text-primary transition-transform ${isOpen ? "rotate-90" : ""}`}
                      >
                        ›
                      </span>
                      <span className="font-display text-lg font-bold uppercase tracking-wide text-on-surface md:text-xl">
                        {prov}
                      </span>
                    </div>
                    <span className="text-label-caps text-[10px] tracking-[0.3em] text-on-surface/50">
                      {hechas}/{munis.length}
                    </span>
                  </button>

                  {isOpen && (
                    <ul className="border-t border-outline-variant bg-background/40">
                      {munis.map((muni) => {
                        const carrera = carrerasByMuni.get(key(prov, muni));
                        const k = key(prov, muni);
                        const isMuniOpen = openMuni === k;
                        if (!carrera) {
                          return (
                            <li
                              key={muni}
                              className="flex items-center justify-between gap-4 border-b border-outline-variant/60 px-6 py-3 pl-14 last:border-b-0 md:px-10 md:pl-20"
                            >
                              <span className="text-sm text-on-surface/35">
                                {muni}
                              </span>
                              <span className="text-label-caps text-[9px] tracking-[0.3em] text-on-surface/30">
                                SIN CARRERA AÚN
                              </span>
                            </li>
                          );
                        }
                        return (
                          <li
                            key={muni}
                            className="border-b border-outline-variant/60 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => setOpenMuni(isMuniOpen ? null : k)}
                              className="flex w-full items-center justify-between gap-4 px-6 py-3 pl-14 text-left transition hover:bg-primary/5 md:px-10 md:pl-20"
                              aria-expanded={isMuniOpen}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  aria-hidden
                                  className={`font-mono text-primary transition-transform ${isMuniOpen ? "rotate-90" : ""}`}
                                >
                                  ›
                                </span>
                                <span className="text-sm font-semibold text-on-surface">
                                  {muni}
                                </span>
                              </div>
                              <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">
                                {carrera.n}/{TOTAL_CANTONES}
                              </span>
                            </button>
                            {isMuniOpen && <CarreraCard carrera={carrera} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}

function CarreraCard({ carrera }: { carrera: Carrera }) {
  return (
    <article className="border-t border-outline-variant bg-surface-container-lowest px-6 py-8 md:px-10 md:py-12">
      <span className="text-label-caps mb-3 block text-[10px] font-bold tracking-[0.4em] text-primary">
        {carrera.municipio.toUpperCase()} {carrera.n}/{TOTAL_CANTONES}
      </span>
      <h2 className="font-display text-2xl font-extrabold leading-tight text-on-surface md:text-4xl">
        {carrera.title}
      </h2>
      <p className="mt-2 font-mono text-[11px] uppercase text-on-surface/40">
        {new Date(carrera.date).toLocaleDateString("es-EC", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </p>
      <p className="font-serif mt-5 max-w-3xl text-base leading-relaxed text-on-surface/75">
        {carrera.desc}
      </p>


      {/* Área reservada para el visor */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          RECORRIDO
        </h3>
        <div
          role="region"
          aria-label="Área reservada para el visor del recorrido"
          className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden border-2 border-dashed border-primary/60 bg-background"
        >
          <div className="pointer-events-none absolute inset-0 [background:repeating-linear-gradient(45deg,transparent_0_12px,rgba(212,163,77,0.06)_12px_24px)]" />
          <div className="pointer-events-none absolute inset-0 [background:linear-gradient(rgba(212,163,77,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(212,163,77,0.08)_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="relative z-10 max-w-md px-6 text-center">
            <span className="text-label-caps mb-3 block text-[10px] tracking-[0.4em] text-primary">
              ESPACIO RESERVADO · IFRAME
            </span>
            <p className="font-display text-lg font-bold text-on-surface md:text-2xl">
              Aquí se integrará el visor del recorrido
            </p>
            <p className="mt-3 text-sm leading-relaxed text-on-surface/60">
              Área preparada para el iframe con mapa y perfil del recorrido de{" "}
              {carrera.municipio}.
            </p>
          </div>
        </div>
      </section>

      {/* Galería */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          GALERÍA
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {carrera.photos.map((p, i) => (
            <div
              key={i}
              className="aspect-[4/3] overflow-hidden border border-outline-variant"
            >
              <img src={p} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* Video */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          VIDEO TESTIMONIAL
        </h3>
        {carrera.videoUrl ? (
          <div className="aspect-video w-full overflow-hidden border border-outline-variant bg-black">
            <video src={carrera.videoUrl} controls className="h-full w-full" />
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center border border-dashed border-outline-variant bg-background text-sm text-on-surface/50">
            Video testimonial próximamente
          </div>
        )}
      </section>

      {/* Etiquetas */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          PROFUNDIZAR
        </h3>
        <div className="flex flex-wrap gap-3">
          {carrera.tags.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className="text-label-caps rounded-full border border-primary/50 px-4 py-2 text-xs tracking-[0.2em] text-primary transition hover:bg-primary/10"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
