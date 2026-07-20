import { createFileRoute, Link } from "@tanstack/react-router";
import heroAsset from "@/assets/hero-andes.jpg.asset.json";
import rumboLogo from "@/assets/rumbo-logo.png.asset.json";
import compass from "@/assets/compass.png";
import { MunicipiosMap } from "@/components/municipios-map";
import { SiteHeader } from "@/components/site-header";
import { repo } from "@/data/repository";
import { formatDuration } from "@/components/bitacora-shell";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "rumbo — 2.210 + 1 km alrededor de Ecuador" },
      {
        name: "description",
        content:
          "Un desafío para sentir un país y un corazón que laten con intensidad. Recorreré los 221 municipios de Ecuador, corriendo 10 km en cada uno.",
      },
    ],
  }),
  component: Home,
});

const worlds = [
  {
    n: "MUNDO 01",
    title: "CARRERAS",
    to: "/carreras",
    desc: "Seguir la aventura en vivo: kilómetros, etapas y el registro en tiempo real de la travesía por los 221 municipios.",
  },
  {
    n: "MUNDO 02",
    title: "HISTORIAS",
    to: "/historias",
    desc: "El alma del territorio: encuentros, iconos geográficos, cultura, nutrición y el desafío físico que define el camino.",
  },
  {
    n: "MUNDO 03",
    title: "BITÁCORA",
    to: "/bitacora",
    desc: "Memoria viva de la expedición: fotos, videos, anotaciones y cuadernos de viaje capturados en cada kilómetro.",
  },
  {
    n: "MUNDO 04",
    title: "¿QUIÉN SOY?",
    to: "/quien-soy",
    desc: "Trayectoria, propósito y la visión detrás del desafío: por qué recorremos el país desde el cuerpo y la memoria.",
  },
] as const;

function Home() {
  const resumen = repo.resumen.get();
  const ultimasCarreras = repo.carreras
    .all()
    .slice()
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
    .slice(0, 2);
  const ultimasHistorias = repo.historias
    .all()
    .slice()
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
    .slice(0, 2);

  const pctMunicipios = resumen.metaCantones
    ? Math.round((resumen.cantonesVisitados / resumen.metaCantones) * 100)
    : 0;
  const pctKm = resumen.metaKilometros
    ? Math.round((resumen.kilometros / resumen.metaKilometros) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />

      {/* Hero */}
      <header className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img
            alt="Cordillera de los Andes ecuatorianos al amanecer"
            src={heroAsset.url}
            className="h-full w-full object-cover saturate-[0.8] brightness-[0.4]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 py-6 text-center md:px-16">
          <div className="mt-12 mb-1">
            <img
              src={rumboLogo.url}
              alt="rumbo"
              className="mx-auto h-48 w-auto max-w-full drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] md:h-64"
            />
          </div>

          {/* Compass separator + big number subtitle */}
          <div className="mb-2 flex items-center justify-center gap-4">
            <span className="h-px w-16 bg-primary/60 md:w-24" />
            <img
              src={compass}
              alt=""
              aria-hidden
              className="h-8 w-8 md:h-10 md:w-10"
            />
            <span className="h-px w-16 bg-primary/60 md:w-24" />
          </div>

          <div className="mb-4 flex items-start justify-center gap-2">
            <span className="font-display font-extrabold leading-none tracking-tight text-on-surface text-[clamp(72px,15vw,144px)]">
              2.210
            </span>
            <span className="mt-2 flex flex-col items-start font-display font-extrabold leading-none text-primary text-[clamp(28px,5vw,52px)] md:mt-3">
              <span>KM</span>
              <span>+1</span>
            </span>
          </div>
          <p className="text-label-caps mb-10 text-on-surface/90 md:text-base md:tracking-[0.4em]">
            ALREDEDOR DE ECUADOR
          </p>



          <p className="font-serif mx-auto mb-6 max-w-2xl text-lg font-normal text-white/90 md:text-2xl md:leading-relaxed">
            Un desafío para sentir un país y un corazón que laten con intensidad
          </p>
          <p className="font-serif mx-auto mb-12 max-w-xl text-base italic text-white/70 md:text-lg md:leading-relaxed">
            Recorreré los 221 municipios de Ecuador, corriendo 10 km en cada uno de ellos. Quiero
            escuchar a mi país desde el cuerpo, la memoria y el camino.
          </p>


          <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
            <Link
              to="/carreras"
              className="text-label-caps w-full bg-primary-container px-8 py-4 text-center tracking-[0.25em] text-on-primary-container shadow-lg transition-all duration-500 hover:bg-[var(--color-accent-blue-hover)] hover:shadow-[0_0_20px_rgba(37,99,235,0.45)] md:w-auto md:px-10"
            >
              ENTRAR A AVENTURA
            </Link>
            <button
              type="button"
              className="text-label-caps w-full bg-primary px-8 py-4 tracking-[0.25em] text-on-primary transition-all duration-500 hover:brightness-110 hover:shadow-[0_0_20px_rgba(245,197,24,0.4)] md:w-auto md:px-10"
            >
              LEER EL MANIFIESTO
            </button>

          </div>

          <div className="mt-12">
            <span className="text-label-caps text-[10px] tracking-[0.4em] text-primary">
              221 Municipios · 10 KM cada uno
            </span>
          </div>
        </div>

        {/* Technical coordinates */}
        <div className="absolute bottom-8 left-6 hidden font-mono text-xs text-on-surface/40 md:block md:left-16">
          <div>0°15′ 78°35′ S</div>
          <div>ALT 2850 M</div>
        </div>
      </header>

      {/* ¿Cómo vamos? */}
      <section id="como-vamos" className="relative border-t border-outline-variant bg-background py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="mb-16 flex items-center gap-6 md:mb-20 md:gap-8">
            <div className="h-px flex-grow bg-outline-variant" />
            <span className="text-label-caps whitespace-nowrap text-[10px] font-bold tracking-[0.4em] text-primary md:text-xs md:tracking-[0.5em]">
              ¿CÓMO VAMOS?
            </span>
            <div className="h-px flex-grow bg-outline-variant" />
          </div>

          {/* Primary metrics */}
          <div className="grid grid-cols-1 divide-y divide-outline-variant md:grid-cols-2 md:divide-y-0 md:divide-x">
            <div className="px-0 pb-12 md:px-10 md:pb-0 lg:px-16">
              <div className="text-label-caps mb-8 text-[10px] tracking-[0.4em] text-primary">MUNICIPIOS</div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-7xl font-extrabold leading-none text-on-surface md:text-8xl">{resumen.cantonesVisitados}</span>
                <span className="font-display text-2xl text-on-surface/50 md:text-3xl">/ {resumen.metaCantones}</span>
              </div>
              <div className="mt-8">
                <div className="mb-3 flex justify-end">
                  <span className="font-display text-2xl font-semibold text-primary">{pctMunicipios}%</span>
                </div>
                <div className="h-px w-full bg-outline-variant">
                  <div className="h-px bg-primary" style={{ width: `${pctMunicipios}%` }} />
                </div>
              </div>

            </div>

            <div className="px-0 pt-12 md:px-10 md:pt-0 lg:px-16">
              <div className="text-label-caps mb-8 text-[10px] tracking-[0.4em] text-primary">KILÓMETROS</div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-7xl font-extrabold leading-none text-on-surface md:text-8xl">{resumen.kilometros}</span>
                <span className="font-display text-2xl text-on-surface/50 md:text-3xl">/ {resumen.metaKilometros.toLocaleString("es-EC")} km</span>
              </div>
              <div className="mt-8">
                <div className="mb-3 flex justify-end">
                  <span className="font-display text-2xl font-semibold text-primary">{pctKm}%</span>
                </div>
                <div className="h-px w-full bg-outline-variant">
                  <div className="h-px bg-primary" style={{ width: `${pctKm}%` }} />
                </div>
              </div>

            </div>
          </div>

          {/* Secondary metrics */}
          <div className="mt-16 border-t border-outline-variant pt-12 md:mt-20 md:pt-16">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              <div>
                <div className="text-label-caps mb-3 text-[10px] tracking-[0.4em] text-on-surface/50">VO₂ MAX</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-on-surface md:text-5xl">{resumen.vo2max ?? "—"}</span>
                  {resumen.vo2max != null && <span className="text-sm text-on-surface/50">ml/kg·min</span>}
                </div>
              </div>
              <div>
                <div className="text-label-caps mb-3 text-[10px] tracking-[0.4em] text-on-surface/50">RECUPERACIÓN</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-on-surface md:text-5xl">{resumen.recuperacion ?? "—"}</span>
                  {resumen.recuperacion != null && <span className="text-sm text-on-surface/50">%</span>}
                </div>
              </div>
              <div>
                <div className="text-label-caps mb-3 text-[10px] tracking-[0.4em] text-on-surface/50">CALORÍAS / ETAPA</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-on-surface md:text-5xl">{resumen.caloriasPromedio ?? "—"}</span>
                  {resumen.caloriasPromedio != null && <span className="text-sm text-on-surface/50">kcal</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Mapa de municipios */}
      <section
        id="mapa"
        className="relative border-t border-outline-variant bg-surface-container-lowest py-24 md:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="mb-12 flex flex-col items-center text-center md:mb-16">
            <span className="text-label-caps mb-4 text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              CARTOGRAFÍA DE LA TRAVESÍA
            </span>
            <h2 className="font-display text-4xl font-extrabold text-on-surface md:text-6xl">
              MAPA DE MUNICIPIOS
            </h2>
            <p className="font-serif mt-6 max-w-2xl text-base leading-relaxed text-on-surface/60">
              Cada pin dorado marca un cantón donde ya corrimos los 10 km. Explora el mapa
              para descubrir por dónde ha pasado la aventura.
            </p>

          </div>

          <MunicipiosMap />
        </div>
      </section>

      {/* Los cuatro mundos */}

      <section id="mundos" className="relative bg-background py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="mb-12 flex items-center gap-6 md:mb-16 md:gap-8">
            <div className="h-px flex-grow bg-outline-variant" />
            <span className="text-label-caps whitespace-nowrap text-[10px] font-bold tracking-[0.4em] text-primary md:text-xs md:tracking-[0.5em]">
              LOS CUATRO MUNDOS DE LA AVENTURA
            </span>
            <div className="h-px flex-grow bg-outline-variant" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {worlds.map((w, i) => (
              <Link
                key={w.title}
                to={w.to}
                className="group relative block border border-outline-variant bg-surface-container-lowest p-8 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-primary hover:shadow-[0_20px_40px_rgba(212,163,77,0.05)] md:p-10"
              >
                <div className="mb-12 flex items-start justify-between md:mb-16">
                  <span className="text-label-caps text-[10px] font-bold tracking-[0.4em] text-primary">
                    {w.n}
                  </span>
                  <span
                    aria-hidden
                    className="material-symbols-outlined text-primary/30 transition-colors group-hover:text-primary"
                  >
                    arrow_forward
                  </span>
                </div>
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold text-on-surface transition-colors group-hover:text-primary md:text-3xl">
                    {w.title}
                  </h3>
                  <p className="font-serif text-base leading-relaxed text-on-surface/60">{w.desc}</p>
                </div>
                <span className="pointer-events-none absolute right-6 bottom-4 font-mono text-[10px] text-on-surface/20">
                  0{i + 1} / 04
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Últimas carreras */}
      <section
        id="ultimas-carreras"
        className="relative border-t border-outline-variant bg-background py-24 md:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="mb-12 flex flex-col items-center text-center md:mb-16">
            <span className="text-label-caps mb-4 text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              KILÓMETRO A KILÓMETRO
            </span>
            <h2 className="font-display text-4xl font-extrabold text-on-surface md:text-6xl">
              ÚLTIMAS CARRERAS
            </h2>
          </div>

          {ultimasCarreras.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface/50">
              Todavía no hay Carreras registradas. Aparecerán aquí en cuanto Cowork procese la primera jornada.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-8">
              {ultimasCarreras.map((r) => {
                const imagen = repo.medios.byId(r.imagenPrincipal)?.rutaWeb;
                const meta = [
                  r.distanciaKm != null ? `${r.distanciaKm} KM` : null,
                  r.desnivelM != null ? `${r.desnivelM} M` : null,
                  r.duracionSeg != null ? formatDuration(r.duracionSeg) : null,
                ].filter(Boolean).join(" · ");
                return (
                  <article key={r.id} className="group cursor-pointer">
                    <div className="relative mb-6 aspect-[16/9] overflow-hidden bg-surface-container-lowest">
                      {imagen ? (
                        <img
                          src={imagen}
                          alt={r.titulo}
                          loading="lazy"
                          width={1600}
                          height={900}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center border border-dashed border-outline-variant text-xs text-on-surface/40">
                          Sin imagen todavía
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-display text-2xl font-bold text-on-surface transition-colors group-hover:text-primary md:text-3xl">
                        {r.titulo}
                      </h3>
                      {meta && (
                        <p className="font-mono text-xs tracking-widest text-on-surface/50 uppercase">
                          {meta}
                        </p>
                      )}
                      <p className="font-serif text-base leading-relaxed text-on-surface/60">
                        {[r.canton, r.provincia].filter(Boolean).join(", ")}
                      </p>
                      <Link
                        to="/carreras"
                        className="text-label-caps inline-flex items-center gap-2 text-primary transition-all hover:gap-4"
                      >
                        VER ETAPA
                        <span aria-hidden className="material-symbols-outlined text-sm">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Últimas historias */}

      <section
        id="ultimas-historias"
        className="relative border-t border-outline-variant bg-surface-container-lowest py-24 md:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="mb-12 flex flex-col items-center text-center md:mb-16">
            <span className="text-label-caps mb-4 text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              RECUERDOS DEL CAMINO
            </span>
            <h2 className="font-display text-4xl font-extrabold text-on-surface md:text-6xl">
              ÚLTIMAS HISTORIAS
            </h2>
          </div>

          {ultimasHistorias.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface/50">
              Todavía no hay Historias aprobadas. Aparecerán aquí en cuanto Fidel apruebe una.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-8">
              {ultimasHistorias.map((s) => {
                const imagen = repo.medios.byId(s.imagen)?.rutaWeb;
                return (
                  <article key={s.id} className="group cursor-pointer">
                    <div className="relative mb-6 aspect-[16/9] overflow-hidden bg-surface-container-lowest">
                      {imagen ? (
                        <img
                          src={imagen}
                          alt={s.titulo}
                          loading="lazy"
                          width={1600}
                          height={900}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center border border-dashed border-outline-variant text-xs text-on-surface/40">
                          Sin imagen todavía
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-display text-2xl font-bold text-on-surface transition-colors group-hover:text-primary md:text-3xl">
                        {s.titulo}
                      </h3>
                      {s.extracto && (
                        <p className="font-serif text-base leading-relaxed text-on-surface/60">{s.extracto}</p>
                      )}
                      <Link
                        to="/historias"
                        className="text-label-caps inline-flex items-center gap-2 text-primary transition-all hover:gap-4"
                      >
                        LEER MÁS
                        <span aria-hidden className="material-symbols-outlined text-sm">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant bg-background pt-20 pb-10">
        <div className="mx-auto max-w-7xl px-6 md:px-16">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
            {/* Brand column */}
            <div>
              <span className="text-label-caps mb-6 block text-[10px] font-bold tracking-[0.4em] text-primary">
                AVENTURA · 2026
              </span>
              <img
                src={rumboLogo.url}
                alt="rumbo"
                className="mb-6 h-8 w-auto md:h-12"
              />
              <p className="font-serif max-w-sm text-sm leading-relaxed text-on-surface/60">
                Una expedición humana viva a través del cuerpo, el territorio y las historias.
                221 municipios, un país por volver a sentir.
              </p>

            </div>

            {/* Navigation column */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-4 bg-on-surface/30" />
                <span className="text-label-caps text-[10px] font-bold tracking-[0.4em] text-on-surface/50">
                  NAVEGAR
                </span>
                <span className="h-px w-4 bg-on-surface/30" />
              </div>
              <ul className="space-y-3">
                {worlds.map((w) => (
                  <li key={w.to}>
                    <Link
                      to={w.to}
                      className="text-label-caps text-xs tracking-[0.3em] text-primary transition-colors hover:text-on-surface"
                    >
                      {w.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact column */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-4 bg-on-surface/30" />
                <span className="text-label-caps text-[10px] font-bold tracking-[0.4em] text-on-surface/50">
                  CONTACTO
                </span>
                <span className="h-px w-4 bg-on-surface/30" />
              </div>
              <ul className="space-y-2 text-sm text-on-surface/70">
                <li>
                  <a href="mailto:hola@rumbo.com" className="transition-colors hover:text-primary">
                    hola@rumbo.com
                  </a>
                </li>
                <li>
                  <a href="mailto:prensa@rumbo.com" className="transition-colors hover:text-primary">
                    prensa@rumbo.com
                  </a>
                </li>
              </ul>
              <p className="mt-6 text-sm text-on-surface/70">Quito · Ecuador</p>
              <a
                href="#"
                className="text-label-caps mt-6 inline-flex items-center gap-2 text-xs tracking-[0.3em] text-primary transition-all hover:gap-4"
              >
                SOBRE EL PROYECTO
                <span aria-hidden className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="mt-16 border-t border-outline-variant pt-6">
            <div className="flex flex-col items-center justify-between gap-3 text-center md:flex-row md:text-left">
              <span className="font-mono text-[10px] tracking-widest text-on-surface/40 uppercase">
                © 2026 · Rumbo
              </span>
              <span className="font-mono text-[10px] tracking-widest text-on-surface/40 uppercase">
                Una aventura humana documentada en tiempo real
              </span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
