import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import heroUrl from "@/assets/hero-andes.jpg";

function PlaceholderImage({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-outline-variant bg-surface-container-lowest text-center ${className}`}
    >
      <ImageOff className="h-6 w-6 text-on-surface/30" aria-hidden />
      <span className="text-label-caps px-4 text-[9px] tracking-[0.2em] text-on-surface/40">{label}</span>
    </div>
  );
}

export const Route = createFileRoute("/quien-soy")({
  head: () => ({
    meta: [
      { title: "¿Quién soy? — rumbo" },
      {
        name: "description",
        content:
          "Mundo 04 · ¿Quién soy? Fidel más allá del corredor: vivir, hacer y correr como una sola mirada sobre Ecuador.",
      },
      { property: "og:title", content: "¿Quién soy? — rumbo" },
      {
        property: "og:description",
        content:
          "Durante años corrí para llegar. Hoy corro para mirar. La historia detrás de RUMBO.",
      },
    ],
  }),
  component: QuienSoyPage,
});

type Camino = { key: string; label: string; body: string };

const CAMINOS: Camino[] = [
  {
    key: "01",
    label: "VIVIR",
    body: "Antes que corredor, alguien que observa. Curioso de los oficios ajenos, de las ciudades pequeñas, de las conversaciones que empiezan por una pregunta simple. Aprendí a volver a empezar más veces de las que planeé, y en ese volver descubrí que la vida se sostiene en lo cotidiano: una mesa, un afecto, una puerta que se abre. Miro el país con esa misma paciencia.",
  },
  {
    key: "02",
    label: "HACER",
    body: "Años trabajando entre proyectos, equipos y contextos distintos me enseñaron a imaginar caminos donde no los hay y a sostenerlos hasta que otros puedan caminarlos. No es un currículo; es una forma de estar. Traigo a RUMBO esa capacidad de organizar lo disperso, conectar personas que aún no se conocen y traducir una idea grande en pasos concretos.",
  },
  {
    key: "03",
    label: "CORRER",
    body: "Primero corrí para llegar: cronómetros, marcas, medallas. Después corrí para volver, tras dos cirugías que me obligaron a caminar de nuevo. Hoy corro para mirar. Cada kilómetro es una forma de detenerse: el cuerpo se vuelve el instrumento que permite escuchar el territorio a la velocidad correcta.",
  },
];

type Momento = { year: string; title: string; body: string };

const MOMENTOS: Momento[] = [
  {
    year: "2013",
    title: "Primer maratón",
    body: "Quito. El punto donde una idea vaga —correr— se vuelve una decisión. No fue el tiempo lo importante, sino descubrir que podía sostener algo largo.",
  },
  {
    year: "2016 — 2019",
    title: "Six World Majors",
    body: "Boston, Berlín, Chicago, Nueva York, Tokio, Londres. Seis ciudades, seis medallas, una misma pregunta al final: ¿qué queda cuando ya alcanzaste lo que perseguías?",
  },
  {
    year: "2020 — 2022",
    title: "Cirugías y recuperación",
    body: "Menisco primero, tendón después. Dos pausas largas que me obligaron a aprender de nuevo cosas simples. En el silencio de esos meses cambió la forma de habitar el cuerpo.",
  },
  {
    year: "2024",
    title: "El regreso",
    body: "Volver a correr sin la urgencia de ganarle a alguien. Trail, montaña, tiempos que ya no importan. El podio dejó de ser el mapa.",
  },
  {
    year: "2025 — 2026",
    title: "Nace RUMBO",
    body: "Un mapa de Ecuador abierto sobre la mesa: 221 municipios, 2.210 + 1 kilómetros. La idea de recorrer el país no para conquistarlo, sino para dejar que me lo cuenten quienes lo habitan.",
  },
];

type Objeto = { name: string; year?: string; place?: string; note: string };

const OBJETOS: Objeto[] = [
  {
    name: "Six Star Medal",
    year: "2019",
    place: "Londres",
    note: "La última de las seis estrellas. Llegó junto con la pregunta que abriría todo lo demás.",
  },
  {
    name: "Dorsal Boston",
    year: "2016",
    place: "Boston, EE. UU.",
    note: "Lluvia y frío. El primer Major. Todavía la guardo doblada en un cajón.",
  },
  {
    name: "Zapatillas de Berlín",
    year: "2017",
    place: "Berlín, Alemania",
    note: "Récord personal. Las suelas todavía cuentan los kilómetros como testigos.",
  },
  {
    name: "Cuaderno de rutas",
    year: "2020 — 2024",
    note: "Anotaciones de recuperación, mapas dibujados a mano, listas de lugares que quería visitar cuando volviera a caminar bien.",
  },
  {
    name: "Camiseta trail andino",
    year: "2024",
    place: "Andes ecuatorianos",
    note: "La que usé el día que entendí que iba a recorrer el país entero.",
  },
  {
    name: "Mapa de trabajo",
    year: "2025",
    note: "Ecuador continental impreso en A0. Círculos, tachones, nombres de municipios. El primer objeto de RUMBO.",
  },
];

type Servicio = { key: string; label: string; body: string };

const SERVICIOS: Servicio[] = [
  {
    key: "01",
    label: "IMAGINAR",
    body: "Ver la expedición completa antes de que exista. Sostener la imagen cuando los detalles todavía no cuadran.",
  },
  {
    key: "02",
    label: "ORGANIZAR",
    body: "Traducir 2.210 kilómetros en etapas, logística, cuidados del cuerpo y del equipo. Que lo aparentemente imposible tenga calendario.",
  },
  {
    key: "03",
    label: "CONECTAR",
    body: "Encontrar a las personas correctas en cada municipio. Escuchar antes de proponer. Tejer la red por la que pasa el proyecto.",
  },
  {
    key: "04",
    label: "CONTAR",
    body: "Poner en palabras y en imágenes lo que va apareciendo en el camino, sin adornar y sin simplificar.",
  },
];

function QuienSoyPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />

      <main className="pt-24">
        {/* Volver */}
        <div className="mx-auto max-w-7xl px-6 pt-6 md:px-16">
          <Link
            to="/"
            hash="mundos"
            className="text-label-caps inline-flex items-center gap-2 text-topbar-muted transition hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a los mundos
          </Link>
        </div>

        {/* 1. APERTURA */}
        <section className="mx-auto max-w-7xl px-6 pt-12 pb-24 md:px-16 md:pt-20 md:pb-32">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-6">
              <div className="text-label-caps text-primary">MUNDO 04 · ¿QUIÉN SOY?</div>
              <h1 className="mt-6 font-display text-4xl leading-[1.05] md:text-6xl">
                DURANTE AÑOS<br />CORRÍ PARA LLEGAR.
                <br />
                <span className="text-primary">HOY CORRO PARA MIRAR.</span>
              </h1>
              <p className="font-serif mt-10 max-w-xl text-base leading-relaxed text-on-surface/80 md:text-lg">
                Mi historia no es una línea recta. Está atravesada por la vida personal, el
                trabajo, el deporte, los viajes, las lesiones, las pausas y, sobre todo, los
                encuentros. RUMBO es lo que aparece cuando todo eso se pone a caminar junto en
                dirección a un país.
              </p>

              <div className="mt-10 flex items-center gap-4">
                <span className="h-px w-16 bg-primary" />
                <span className="text-label-caps text-topbar-muted">FIDEL · 2026</span>
              </div>
            </div>

            <div className="md:col-span-6">
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <PlaceholderImage label="RETRATO PENDIENTE" />
              </div>
              <p className="text-label-caps mt-4 text-topbar-muted">
                RETRATO · ANTES DEL KM 0
              </p>
            </div>
          </div>
        </section>

        {/* 2. TRES CAMINOS */}
        <section className="border-t border-outline-variant">
          <div className="mx-auto max-w-7xl px-6 py-24 md:px-16 md:py-32">
            <div className="max-w-3xl">
              <div className="text-label-caps text-primary">02 · TRES CAMINOS</div>
              <h2 className="mt-6 font-display text-3xl leading-tight md:text-5xl">
                Tres caminos,<br />
                <span className="text-primary">una misma mirada.</span>
              </h2>
              <p className="font-serif mt-6 max-w-2xl text-base text-on-surface/70 md:text-lg">
                Vivir, hacer y correr no son capítulos separados. Se cruzan todo el tiempo. Este
                proyecto es lo que sucede cuando esas tres formas de estar en el mundo se ponen a
                trabajar juntas.
              </p>

            </div>

            <div className="mt-16 grid grid-cols-1 gap-px bg-outline-variant md:grid-cols-3">
              {CAMINOS.map((c) => (
                <div key={c.key} className="bg-background p-8 md:p-10">
                  <div className="text-label-caps text-topbar-muted">{c.key}</div>
                  <h3 className="mt-4 font-display text-3xl text-primary md:text-4xl">
                    {c.label}
                  </h3>
                  <p className="font-serif mt-6 text-sm leading-relaxed text-on-surface/80 md:text-base">
                    {c.body}
                  </p>

                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. MOMENTOS */}
        <section className="border-t border-outline-variant bg-surface-container-lowest">
          <div className="mx-auto max-w-7xl px-6 py-24 md:px-16 md:py-32">
            <div className="max-w-3xl">
              <div className="text-label-caps text-primary">03 · TRAYECTORIA</div>
              <h2 className="mt-6 font-display text-3xl leading-tight md:text-5xl">
                Los momentos que cambiaron el rumbo.
              </h2>
              <p className="font-serif mt-6 max-w-2xl text-base text-on-surface/70 md:text-lg">
                Cinco momentos. Cada uno cambió algo por dentro antes de cambiar algo por fuera.
              </p>

            </div>

            <ol className="mt-16 space-y-px bg-outline-variant">
              {MOMENTOS.map((m, i) => (
                <li
                  key={m.year}
                  className="grid grid-cols-1 gap-6 bg-surface-container-lowest px-2 py-8 md:grid-cols-12 md:gap-10 md:px-6 md:py-10"
                >
                  <div className="md:col-span-2">
                    <div className="text-label-caps text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="mt-2 font-mono text-sm text-on-surface/70">{m.year}</div>
                  </div>
                  <div className="md:col-span-4">
                    <h3 className="font-display text-2xl md:text-3xl">{m.title}</h3>
                  </div>
                  <p className="font-serif text-sm leading-relaxed text-on-surface/80 md:col-span-6 md:text-base">
                    {m.body}
                  </p>

                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. LO QUE QUEDA */}
        <section className="border-t border-outline-variant">
          <div className="mx-auto max-w-7xl px-6 py-24 md:px-16 md:py-32">
            <div className="max-w-3xl">
              <div className="text-label-caps text-primary">04 · OBJETOS</div>
              <h2 className="mt-6 font-display text-3xl leading-tight md:text-5xl">
                Lo que queda después de correr.
              </h2>
              <p className="font-serif mt-6 max-w-2xl text-base text-on-surface/70 md:text-lg">
                No son trofeos. Son pistas. Cada objeto guarda un pedazo de historia que ayuda a
                entender por qué hoy estoy caminando el país.
              </p>

            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {OBJETOS.map((o) => (
                <article key={o.name} className="group">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-low">
                    <PlaceholderImage label="FOTO PENDIENTE" />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <h3 className="font-display text-lg text-on-surface">{o.name}</h3>
                    <span className="text-label-caps text-topbar-muted">
                      {[o.year, o.place].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <p className="font-serif mt-2 text-sm leading-relaxed text-on-surface/70">{o.note}</p>
                </article>
              ))}
            </div>

            <p className="text-label-caps mt-12 text-topbar-muted">
              GALERÍA EN CONSTRUCCIÓN · SE INCORPORARÁN FOTOGRAFÍAS ORIGINALES
            </p>
          </div>
        </section>

        {/* 5. LO QUE SÉ PONER AL SERVICIO */}
        <section className="border-t border-outline-variant bg-surface-container-lowest">
          <div className="mx-auto max-w-7xl px-6 py-24 md:px-16 md:py-32">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
              <div className="md:col-span-5">
                <div className="text-label-caps text-primary">05 · OFICIO</div>
                <h2 className="mt-6 font-display text-3xl leading-tight md:text-5xl">
                  Lo que sé poner al servicio del camino.
                </h2>
                <p className="font-serif mt-6 text-base text-on-surface/70 md:text-lg">
                  No traigo un currículo a este proyecto. Traigo formas de trabajar aprendidas en
                  años de imaginar, sostener y contar cosas junto a otras personas.
                </p>

              </div>

              <div className="grid grid-cols-1 gap-px bg-outline-variant sm:grid-cols-2 md:col-span-7">
                {SERVICIOS.map((s) => (
                  <div key={s.key} className="bg-surface-container-lowest p-8">
                    <div className="text-label-caps text-topbar-muted">{s.key}</div>
                    <h3 className="mt-3 font-display text-2xl text-primary">{s.label}</h3>
                    <p className="font-serif mt-4 text-sm leading-relaxed text-on-surface/80">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-label-caps mt-16 text-topbar-muted">
              CONTENIDO PROFESIONAL DETALLADO · PENDIENTE DE COMPLETAR
            </p>
          </div>
        </section>

        {/* 6. ES MÁS QUE CORRER */}
        <section className="border-t border-outline-variant">
          <div className="relative">
            <div className="absolute inset-0">
              <img
                src={heroUrl}
                alt="Territorio andino de Ecuador"
                className="h-full w-full object-cover opacity-25"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
            </div>

            <div className="relative mx-auto max-w-4xl px-6 py-32 text-center md:px-16 md:py-48">
              <div className="text-label-caps text-primary">06 · SENTIDO</div>
              <h2 className="mt-8 font-display text-4xl leading-[1.05] md:text-6xl">
                Es más que correr.
              </h2>
              <div className="mx-auto mt-10 max-w-2xl space-y-6 text-base leading-relaxed text-on-surface/85 md:text-lg">
                <p className="font-serif">
                  RUMBO es una forma de volver a mirar Ecuador. El cuerpo se vuelve el medio que
                  permite atravesar el territorio a la velocidad de las personas, no a la de un
                  itinerario.
                </p>
                <p className="font-serif">
                  Correr, en este caso, sirve para detenerse: llegar hasta un lugar, apagar el
                  reloj, sentarse en una banca, escuchar a quien viva allí. Los kilómetros
                  vuelven visible el desafío, pero son las voces, los oficios y los relatos
                  encontrados los que le dan sentido.
                </p>
                <p className="font-display text-xl text-primary md:text-2xl">
                  221 municipios. 2.210 + 1 kilómetros. Un país entero como maestro.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* 7. ARTÍCULOS */}
        <section className="border-t border-outline-variant bg-surface-container-lowest">
          <div className="mx-auto max-w-7xl px-6 py-24 md:px-16 md:py-32">
            <div className="max-w-3xl">
              <div className="text-label-caps text-primary">07 · LECTURAS</div>
              <h2 className="mt-6 font-display text-3xl leading-tight md:text-5xl">
                Otras formas de conocer mi recorrido.
              </h2>
              <p className="font-serif mt-6 max-w-2xl text-base text-on-surface/70 md:text-lg">
                Aquí irán artículos, entrevistas y textos que he ido compartiendo. No como
                reconocimientos: como pistas de lectura para quien quiera entrar por otra puerta.
              </p>

            </div>

            <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex aspect-[4/3] flex-col justify-between border border-outline-variant bg-background p-8"
                >
                  <div className="text-label-caps text-topbar-muted">ESPACIO {String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="font-display text-lg text-on-surface/40">
                      Título del artículo pendiente
                    </div>
                    <div className="text-label-caps mt-2 text-topbar-muted">
                      MEDIO · FECHA · ENLACE
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-label-caps mt-12 text-topbar-muted">
              SECCIÓN PREPARADA PARA CONTENIDO FUTURO
            </p>
          </div>
        </section>

        {/* 8. CIERRE */}
        <section className="relative border-t border-outline-variant">
          <div className="absolute inset-0">
            <img
              src={heroUrl}
              alt="Territorio andino de Ecuador"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          </div>

          <div className="relative mx-auto max-w-5xl px-6 py-32 text-center md:px-16 md:py-48">
            <h2 className="font-display text-3xl leading-[1.1] md:text-5xl">
              NO CORRO ALREDEDOR DE ECUADOR<br />PARA DECIR QUE LO RECORRÍ.
              <br />
              <span className="text-primary">
                CORRO PARA PERMITIR QUE EL PAÍS ME CAMBIE.
              </span>
            </h2>

            <div className="mt-12">
              <Link
                to="/carreras"
                className="text-label-caps inline-flex items-center gap-3 bg-primary px-8 py-4 text-on-primary transition hover:brightness-110"
              >
                CONOCER LA EXPEDICIÓN
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-outline-variant">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-10 text-topbar-muted md:flex-row md:items-center md:px-16">
            <div className="text-label-caps">RUMBO · 2.210 + 1 KM</div>
            <div className="text-label-caps">MUNDO 04 · ¿QUIÉN SOY?</div>
          </div>
        </footer>
      </main>
    </div>
  );
}
