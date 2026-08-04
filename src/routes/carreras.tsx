import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { repo } from "@/data/repository";
import { formatDuration } from "@/components/bitacora-shell";
import { RutaMap } from "@/components/ruta-map";
import type { CantonWeb, CarreraWeb } from "@/data/types";

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

function key(prov: string, canton: string) {
  return `${prov}::${canton}`.toLowerCase();
}

function CarrerasPage() {
  const cantones = repo.cantones.all();
  const carrerasById = useMemo(
    () => new Map(repo.carreras.all().map((c) => [c.id, c])),
    []
  );
  const resumen = repo.resumen.get();

  const provincias = useMemo(
    () => Array.from(new Set(cantones.map((c) => c.provincia))).sort(),
    [cantones]
  );
  const [openProv, setOpenProv] = useState<string | null>(provincias[0] ?? null);
  const [openMuni, setOpenMuni] = useState<string | null>(null);

  const totalHechas = resumen.cantonesVisitados;

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
              cantones para ver los recorridos completados.
            </p>

            <div className="mt-8 inline-flex items-baseline gap-3 border border-primary/40 px-6 py-3">
              <span className="font-display text-3xl font-extrabold text-primary md:text-4xl">
                {totalHechas}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-on-surface/60">
                / {resumen.metaCantones} cantones
              </span>
            </div>
          </div>

          <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest">
            {provincias.map((prov) => {
              const cantonesProv = cantones
                .filter((c) => c.provincia === prov)
                .slice()
                .sort((a, b) => a.canton.localeCompare(b.canton));
              const hechas = cantonesProv.filter((c) => c.visitado).length;
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
                      {hechas}/{cantonesProv.length}
                    </span>
                  </button>

                  {isOpen && (
                    <ul className="border-t border-outline-variant bg-background/40">
                      {cantonesProv.map((canton) => {
                        const k = key(prov, canton.canton);
                        const isMuniOpen = openMuni === k;
                        const carrera = canton.carrerasIds.length
                          ? carrerasById.get(canton.carrerasIds[0])
                          : undefined;
                        if (!carrera) {
                          return (
                            <li
                              key={canton.cantonId}
                              className="flex items-center justify-between gap-4 border-b border-outline-variant/60 px-6 py-3 pl-14 last:border-b-0 md:px-10 md:pl-20"
                            >
                              <span className="text-sm text-on-surface/35">
                                {canton.canton}
                              </span>
                              <span className="text-label-caps text-[9px] tracking-[0.3em] text-on-surface/30">
                                SIN CARRERA AÚN
                              </span>
                            </li>
                          );
                        }
                        return (
                          <li
                            key={canton.cantonId}
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
                                  {canton.canton}
                                </span>
                              </div>
                              <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">
                                {canton.numCarreras} carrera{canton.numCarreras === 1 ? "" : "s"}
                              </span>
                            </button>
                            {isMuniOpen && <CarreraCard carrera={carrera} canton={canton} />}
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

function CarreraCard({ carrera, canton }: { carrera: CarreraWeb; canton: CantonWeb }) {
  const imagenPrincipal = repo.medios.byId(carrera.imagenPrincipal)?.rutaWeb;
  const galeria = carrera.galeria
    .map((id) => repo.medios.byId(id))
    .filter((m): m is NonNullable<typeof m> => !!m && m.tipo === "fotografia");
  const video = carrera.galeria
    .map((id) => repo.medios.byId(id))
    .find((m) => m?.tipo === "video");

  const meta = [
    carrera.distanciaKm != null ? `${carrera.distanciaKm} km` : null,
    carrera.desnivelM != null ? `+${carrera.desnivelM} m` : null,
    carrera.duracionSeg != null ? formatDuration(carrera.duracionSeg) : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className="border-t border-outline-variant bg-surface-container-lowest px-6 py-8 md:px-10 md:py-12">
      <span className="text-label-caps mb-3 block text-[10px] font-bold tracking-[0.4em] text-primary">
        {canton.canton.toUpperCase()}
      </span>
      <h2 className="font-display text-2xl font-extrabold leading-tight text-on-surface md:text-4xl">
        {carrera.titulo}
      </h2>
      {carrera.fechaPublica && (
        <p className="mt-2 font-mono text-[11px] uppercase text-on-surface/40">
          {new Date(carrera.fechaPublica).toLocaleDateString("es-EC", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
      {meta && (
        <p className="mt-2 font-mono text-[11px] uppercase text-on-surface/40">{meta}</p>
      )}
      {carrera.descripcionCorta && (
        <p className="font-serif mt-5 max-w-3xl text-base leading-relaxed text-on-surface/75">
          {carrera.descripcionCorta}
        </p>
      )}
      {imagenPrincipal && (
        <div className="mt-6 aspect-[16/9] w-full overflow-hidden border border-outline-variant">
          <img src={imagenPrincipal} alt={carrera.titulo} className="h-full w-full object-cover" />
        </div>
      )}

      {/* Área reservada para el visor */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          RECORRIDO
        </h3>
        {carrera.rutaGeojson ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden border border-outline-variant bg-surface-container-lowest">
            <RutaMap geojsonUrl={carrera.rutaGeojson} />
          </div>
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center border border-dashed border-outline-variant bg-background text-sm text-on-surface/50">
            Recorrido todavía sin mapa disponible
          </div>
        )}
      </section>

      {/* Galería */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          GALERÍA
        </h3>
        {galeria.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {galeria.map((m, i) => (
              <div
                key={i}
                className="aspect-[4/3] overflow-hidden border border-outline-variant"
              >
                <img src={m.rutaWeb ?? undefined} alt={m.titulo ?? ""} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-on-surface/50">Sin fotografías todavía.</p>
        )}
      </section>

      {/* Video: la sección completa se oculta si no hay video asociado */}
      {video?.rutaWeb && (
        <section className="mt-8">
          <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
            VIDEO DE LA CARRERA
          </h3>
          <div className="aspect-video w-full overflow-hidden border border-outline-variant bg-black">
            <video src={video.rutaWeb} controls className="h-full w-full" />
          </div>
        </section>
      )}

      {/* Etiquetas */}
      <section className="mt-8">
        <h3 className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.4em] text-primary">
          PROFUNDIZAR
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/historias"
            className="text-label-caps rounded-full border border-primary/50 px-4 py-2 text-xs tracking-[0.2em] text-primary transition hover:bg-primary/10"
          >
            Historias relacionadas
          </Link>
          <Link
            to="/bitacora"
            className="text-label-caps rounded-full border border-primary/50 px-4 py-2 text-xs tracking-[0.2em] text-primary transition hover:bg-primary/10"
          >
            Bitácora del día
          </Link>
        </div>
      </section>
    </article>
  );
}
