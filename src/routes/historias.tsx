import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Facebook, Instagram, MessageCircle, Search } from "lucide-react";
import { Toaster, toast } from "sonner";
import storyCotopaxi from "@/assets/story-cotopaxi.jpg.asset.json";
import storySabiduria from "@/assets/story-sabiduria.jpg.asset.json";
import raceQuito from "@/assets/race-quito.jpg.asset.json";
import raceCuenca from "@/assets/race-cuenca.jpg.asset.json";
import heroAndes from "@/assets/hero-andes.jpg.asset.json";

export const Route = createFileRoute("/historias")({
  head: () => ({
    meta: [
      { title: "HISTORIAS — rumbo" },
      {
        name: "description",
        content:
          "Mundo 02 · HISTORIAS. Lugares, comidas, personas, entrevistas y lo que va a redes sociales.",
      },
    ],
  }),
  component: HistoriasPage,
});

type Formato = "blog" | "fotopostal" | "video" | "entrevista";

type Historia = {
  slug: string;
  formato: Formato;
  title: string;
  date: string; // ISO
  excerpt: string;
  cover: string;
  body: string;
  videoUrl?: string;
};

const FORMATO_LABEL: Record<Formato, string> = {
  blog: "BLOG",
  fotopostal: "FOTOPOSTAL",
  video: "VIDEO",
  entrevista: "ENTREVISTA",
};

// Mock — reemplazar por lectura de la hoja "Historias" de Google Sheets.
const HISTORIAS: Historia[] = [
  {
    slug: "hostal-atacames",
    formato: "blog",
    title: "El hostal de Atacames que me salvó la noche",
    date: "2026-06-30",
    excerpt:
      "Llegué tarde, cansado y con hambre de mar. Una casa de madera con hamaca y ventilador se convirtió en el mejor plan de costa.",
    body: "La carrera de la tarde se alargó más de lo previsto. El sol se cayó de golpe sobre Atacames y yo seguía buscando dónde quedarme. Los hoteles del malecón estaban llenos, o eran demasiado caros para una noche corta, o simplemente no me gustaban.\n\nCaminé cuatro cuadras hacia dentro, lejos del ruido. Encontré una casa de madera pintada de azul, con un letrero escrito a mano: “Hay hamaca”. Toqué la puerta. Salió una señora de sesenta años con delantal florido y me dijo que sí, que quedaba una habitación, con ventilador y baño compartido, por quince dólares.\n\nLa habitación era chica pero limpia. Sábanas blancas, una silla, una ventana que daba a un patio con matas de plátano. La señora me trajo agua fría en un vaso de vidrio y me preguntó si había comido. Le dije que no. Me sirvió arroz con pescado frito, sin cobrarme extra.\n\nEsa noche dormí con el ventilador encendido y el sonido del mar a lo lejos. A las cinco de la mañana un gallo me despertó. Salí al patio, tomé café con la señora, y entendí que a veces el mejor plan de costa no está en el malecón.",
    cover: raceCuenca.url,
  },
  {
    slug: "chef-cuy-latacunga",
    formato: "entrevista",
    title: "Entrevista con la chef que cocina cuy asado en Latacunga",
    date: "2026-06-28",
    excerpt:
      '"El secreto no es el horno, es el miedo", dice doña Elsa mientras voltea la canal. Una conversación sobre fuego, tradición y sabor.',
    body: "—¿Cuántos cuyes ha preparado en la vida, doña Elsa?\n—Contados, no. Pero cada uno merece su propio rezo. Uno no cocina cuy como cocina papas. El cuy pide respeto.\n\n—¿Y cuál es el secreto?\n—El secreto no es el horno, mijo. Es el miedo. Miedo de que se queme, miedo de que quede crudo, miedo de que la familia diga que ya no es como el de la abuela. Ese miedo te mantiene despierta frente al fuego.\n\n—¿Cuánto tiempo lleva usted en esto?\n—Cuarenta y tres años. Empecé a los quince, ayudando a mi mamá en el mercado de Saquisilí. Ella preparaba diez cuyes cada domingo. Yo preparo veinte, treinta a veces, cuando hay fiesta.\n\n—¿Y la receta?\n—Sal, ajo, comino, un poquito de achiote. Nada más. La gente cree que hay que ponerle mil cosas y no. El cuy sabe a cuy, no a especias.\n\n—¿Qué le dice a los que dicen que es una crueldad?\n—Que vengan y coman con nosotros. Que vean que aquí nada se pierde. Que este animal alimentó a mi mamá, a mi abuela, a mi bisabuela. Es comida, es cultura, es identidad. No es capricho.\n\nDoña Elsa voltea la canal sobre el carbón. El aroma llena el patio. Me sirve un plato con papa, mote y salsa de maní. Me dice: come, mijo, que se enfría. Y me quedo callado, comiendo.",
    cover: storySabiduria.url,
  },
  {
    slug: "cotopaxi-amanecer",
    formato: "blog",
    title: "El Cotopaxi al amanecer: silencio y nieve",
    date: "2026-06-26",
    excerpt:
      "La montaña más fotografiada del Ecuador no se deja ver siempre. Esa mañana el páramo se abrió y entendí por qué la llaman sagrada.",
    body: "Subí al mirador antes de las cinco. El frío mordía los dedos y la respiración se volvía humo. El páramo estaba cerrado por la niebla y yo pensaba que había hecho el viaje en vano.\n\nMe senté en una piedra a esperar. No había nadie más, solo el viento y el ruido de mis propios pasos alejándose en la memoria. Saqué el termo de café que había preparado en el hostal la noche anterior. Sabía a canela y a paciencia.\n\nA las 5:47, algo cambió. La niebla se levantó de golpe, como si alguien hubiera tirado de un velo. Y allí estaba: el Cotopaxi. Blanco, gigantesco, con un cono perfecto contra un cielo que empezaba a ponerse rosa. Nunca había visto algo tan cerca del silencio.\n\nMe quedé quieto. No saqué la cámara. No quería que la foto se llevara el momento antes de que yo lo hubiera tenido completo. La montaña estuvo despejada apenas doce minutos. Después volvió a cubrirse.\n\nBajé del mirador con las manos frías y el pecho caliente. Entendí por qué los antiguos la llamaban sagrada. No es una metáfora. Es un hecho que se siente en el cuerpo.",
    cover: storyCotopaxi.url,
  },
  {
    slug: "malecon-instagram",
    formato: "fotopostal",
    title: "Cinco fotos del Malecón 2000 para Instagram",
    date: "2026-06-22",
    excerpt:
      "El ícono de Guayaquil visto desde ángulos que no salen en las guías. Desde el faro hasta el reloj público.",
    body: "1. El faro al atardecer, con el cerro Santa Ana de fondo. La luz dorada rebota en las casas pintadas y crea un degradé que ningún filtro replica. Mejor hora: 18:15.\n\n2. El reloj público desde abajo, con las columnas enmarcando la esfera. Da la sensación de que el tiempo pesa. Mejor hora: media mañana, cuando la luz entra oblicua.\n\n3. Los jardines desde el segundo nivel, mirando hacia el río Guayas. La geometría de los senderos se abre como un abanico verde. Mejor hora: al mediodía, con sombra fuerte.\n\n4. La proa de La Perla, la rueda moscovita, contra el cielo azul. Detalle: espera a que una cabina esté en el punto más alto y dispara desde abajo. Da vértigo visual.\n\n5. El paseo de la ceibita, un rincón poco fotografiado, cerca del muelle. Hay una banca vieja y un árbol que parece de otro tiempo. Es la foto que nadie hace y que la ciudad merece.",
    cover: heroAndes.url,
  },
  {
    slug: "dona-rosa-guaranda",
    formato: "fotopostal",
    title: "Doña Rosa, la del café en Guaranda",
    date: "2026-06-20",
    excerpt:
      "Me dio café con panela y me contó que su nieto también corre. \"Corran bonito, mijo\", dijo.",
    body: "La puerta de la cocina olía a canela recién molida. Doña Rosa estaba frente a la olla, revolviendo algo que humeaba. Me hizo pasar sin preguntar quién era. En Guaranda, todavía se hace así.\n\nMe sirvió café con panela en un pocillo de cerámica. Estaba tan caliente que tuve que soplarle. Ella se sentó frente a mí y me miró correr los dedos por el borde de la mesa.\n\n—Usted es el que corre, ¿no?\n—Sí, doña Rosa.\n—Mi nieto también corre. En Riobamba. Dice que va a hacer una maratón allá en Buenos Aires.\n—Ojalá le vaya bien.\n—A los dos les digo lo mismo: corran bonito, mijo. Que la vida no se gana por ir rápido.\n\nMe quedé una hora en su cocina. Me contó de sus tres hijos, de la casa que construyó vendiendo café en el mercado, del terremoto del 87 que casi se les cae encima. Cuando me fui, no me dejó pagar el café.\n\n—Otro día viene y me trae una foto de la meta —dijo—. Esa sí me la cobro.",
    cover: storySabiduria.url,
  },
  {
    slug: "encebollado-manta",
    formato: "fotopostal",
    title: "Encebollado en Manta a las seis de la mañana",
    date: "2026-06-15",
    excerpt:
      "Después de veintiún kilómetros, el caldo caliente sabe a hogar. El limón, la cebolla, el chifle: todo en su punto.",
    body: "El puesto estaba frente al mercado. El dueño, sin preguntar, sirvió doble porción. Me vio la cara de haber corrido de madrugada y entendió todo.\n\nEl caldo humeaba. Albacora fresca, yuca deshecha, cebolla morada encurtida hasta el punto exacto en que ya no muerde pero todavía cruje. Le exprimí dos limones y le eché una cucharada de ají de tomate de árbol. El chifle iba aparte, en una canastita de plástico.\n\nEl primer sorbo me devolvió al cuerpo. Sudaba todavía la carrera y ya sudaba el caldo, y eran sudores distintos, uno se iba, otro llegaba. Alrededor, los estibadores del mercado desayunaban lo mismo. Nadie hablaba mucho. El encebollado a las seis de la mañana no es tema, es rito.\n\nPagué tres dólares. Le pregunté al dueño hace cuánto vendía ahí. Me dijo: veintidós años, mijo, y todavía no sé si la receta es del abuelo o si el abuelo era la receta.",
    cover: raceCuenca.url,
  },
  {
    slug: "pasillo-en-loja",
    formato: "video",
    title: "Un pasillo en la plaza de Loja",
    date: "2026-06-10",
    excerpt:
      "Tres guitarras, una voz. La ciudad musical del Ecuador me despidió con una canción que aún no olvido.",
    body: "Grabé este video en la plaza San Sebastián, justo cuando las luces se encendían. Tres guitarristas viejos, sombrero de paño, y una señora cantando con la voz de quien ha llorado sin dramatismo.\n\nLa canción se llamaba “Angel de luz”. Yo no la conocía. La gente sí. Se detenían, se sacaban el sombrero, cerraban los ojos. Un niño de nueve años se paró frente a los músicos y aplaudió antes de tiempo. Nadie le dijo nada.\n\nLoja se hace llamar la capital musical del Ecuador y ese título no es marketing. Es una ciudad donde el pasillo todavía se canta en la calle, sin escenario, sin micrófono, sin cobro. Sale porque tiene que salir.\n\nCuando terminaron, dejé cinco dólares en la funda de la guitarra. La señora me dijo gracias con la mirada y siguió con la siguiente canción. Yo caminé hacia el hostal despacio, sin auriculares, porque no quería tapar nada.",
    cover: heroAndes.url,
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    slug: "ampollas-y-lecciones",
    formato: "blog",
    title: "Ampollas, lecciones y zapatos nuevos",
    date: "2026-06-05",
    excerpt:
      "Nadie te dice que el peor enemigo no es la distancia, sino una costura mal puesta. Aquí lo que aprendí después de tres carreras.",
    body: "Cambié de zapatos en la carrera cuatro. Fue un error. Los zapatos anteriores tenían 400 kilómetros y todavía respondían; los nuevos eran del mismo modelo, misma talla, mismo color. Pero no eran los mismos.\n\nA los diez kilómetros sentí una molestia leve en el metatarso derecho. A los quince, la molestia era ardor. A los veintiún, cada paso era una decisión moral. Terminé cojeando y con dos ampollas del tamaño de una moneda de dólar.\n\nLo que aprendí, en orden:\n\n1. Los zapatos nuevos se estrenan en entrenamientos, no en carreras. Aunque sean del mismo modelo. Aunque los use hace diez años. La suela se moldea al pie con el tiempo, y esa memoria no se transfiere.\n\n2. Las medias importan más que los zapatos. Una costura mal puesta destruye una carrera. Llevo dos pares de repuesto en la mochila, siempre.\n\n3. La vaselina no es opcional. Rodillas, ingle, axilas, empeine. Todo lo que pueda rozar, roza. La primera vez que se me olvidó, terminé el maratón con sangre en la camiseta y en el short. No volvió a pasar.\n\n4. Escuchar al cuerpo no es rendirse. Es economía. Bajar un minuto por kilómetro los primeros cinco kilómetros ahorra veinte minutos de sufrimiento al final.\n\n5. Nadie te va a decir todo esto. Toca aprenderlo a costa del cuerpo. Que este texto le sirva a alguien que empieza.",
    cover: raceQuito.url,
  },
  {
    slug: "mitad-del-mundo",
    formato: "fotopostal",
    title: "Un pie en cada hemisferio",
    date: "2026-05-30",
    excerpt:
      "La línea amarilla no es la equinoccial real, pero la foto sí lo es. Y la sensación también.",
    body: "La visita fue rápida: llegar, correr, foto, café de canela. La línea amarilla del monumento no está donde debería estar geográficamente; la equinoccial real pasa unos doscientos cuarenta metros más al norte, en el Museo Intiñan. Pero eso, en la práctica, no le importa a nadie. La foto es la foto.\n\nMe puse un pie a cada lado de la línea y una señora de Cuenca me tomó la foto con mi cámara. Me devolvió el celular y me dijo: “mijo, ahora ya está en dos mundos al mismo tiempo”. Me pareció una frase generosa para una línea pintada.\n\nCorrí después una vuelta al parque de la Mitad del Mundo, ocho kilómetros muy suaves, como para calentar antes del entrenamiento largo del día siguiente. Terminé con un café de canela en un puesto ambulante, mirando el monumento contra el cielo de Pichincha.\n\nRUMBO también es esto: llegar a un lugar que ya está fotografiado un millón de veces y aun así intentar mirarlo con calma. La foto vale menos que el minuto quieto antes de tomarla.",
    cover: heroAndes.url,
  },
  {
    slug: "hornado-en-sangolqui",
    formato: "blog",
    title: "El hornado de Sangolquí: crónica de un domingo",
    date: "2026-05-24",
    excerpt:
      "Cerdo, mote, agrio, tortilla. Una receta que aquí es religión de mercado dominguero.",
    body: "Llegué con hambre de carrera y salí con hambre de otra carrera. El mercado de Sangolquí, un domingo, es una postal que huele. Vapores de mote saliendo de ollas grandes, hornos de barro con puercos enteros dorándose despacio, tortillas de papa recién hechas, agrio en botellas de plástico reutilizadas.\n\nMe senté en uno de los puestos más viejos, el de doña Blanca. Pedí un plato completo: cuero crocante, carne blanda, mote, agrio de chicha, tortilla de papa con queso, ensalada. Once dólares. Suficiente para dos.\n\nDoña Blanca me contó que su horno tiene cuarenta años. Que lo heredó de su suegra. Que cada domingo hornea cuatro puercos y cada domingo se venden. Que el secreto está en la chicha con la que baña la piel antes de meterlo al horno. Le pedí la receta. Me dijo que no.\n\n—Si le digo, mijo, ya no me viene a buscar. Y me gusta que me venga a buscar.\n\nJusto. Volveré.",
    cover: storyCotopaxi.url,
  },
  {
    slug: "frio-del-paramo",
    formato: "video",
    title: "El frío del páramo a 3.800 metros",
    date: "2026-05-18",
    excerpt:
      "Video corto: cómo se corre cuando el aire pesa y las manos no responden.",
    body: "A 3.800 m sobre el nivel del mar, cada respiración se siente como un pequeño logro. El aire pesa menos, sí, pero justamente por eso el cuerpo trabaja más para extraer el oxígeno que en la costa te llega gratis.\n\nEste video lo grabé en el páramo de Zumbahua, camino a la laguna del Quilotoa. Salí a correr diez kilómetros suaves para aclimatarme. Terminé en seis, con las manos entumecidas y los labios morados. El frío del páramo no es el frío de la ciudad. Es un frío húmedo, con viento constante, que se mete debajo de la ropa aunque uno lleve tres capas.\n\nLas manos son lo primero que se rinde. Dejan de responder al cierre del reloj, a la cremallera de la chaqueta, al gel de carbohidratos que uno intenta abrir. Después vienen los pies, si los calcetines no son técnicos. Y por último la cara, cuando el viento seca la piel más rápido de lo que uno alcanza a sudar.\n\nLo que sí funciona a 3.800 m:\n\n- Correr por minutos, no por kilómetros. El ritmo miente.\n- Beber pequeños sorbos, muy seguido. La deshidratación en altura es traicionera.\n- Llevar guantes finos siempre, aunque haga sol al inicio.\n- Bajar antes de que oscurezca. Siempre.\n\nEl páramo enseña otra cosa: que correr no es siempre ir más rápido. A veces es simplemente seguir moviéndose, con calma, mientras el cuerpo se adapta a un aire que no te pertenece.",
    cover: storySabiduria.url,
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
];

const MESES_LARGO_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDate(d: string) {
  // Parseo manual YYYY-MM-DD para evitar corrimiento por zona horaria (SSR/cliente).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const [, y, mo, day] = m;
  const idx = parseInt(mo, 10) - 1;
  if (idx < 0 || idx > 11) return d;
  return `${day} de ${MESES_LARGO_ES[idx]} de ${y}`;
}

function buildShareUrl(slug: string) {
  if (typeof window === "undefined") return `/historias#${slug}`;
  return `${window.location.origin}/historias#${slug}`;
}

function shareFacebook(h: Historia) {
  const url = encodeURIComponent(buildShareUrl(h.slug));
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer");
}

function shareWhatsApp(h: Historia) {
  const text = encodeURIComponent(`${h.title} — ${buildShareUrl(h.slug)}`);
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}

async function shareInstagram(h: Historia) {
  try {
    await navigator.clipboard.writeText(buildShareUrl(h.slug));
    toast("Enlace copiado. Pégalo en una historia o publicación de Instagram.");
  } catch {
    toast("No se pudo copiar el enlace.");
  }
}

function HistoriasPage() {
  const [query, setQuery] = useState("");

  const historias = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? HISTORIAS.filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            h.excerpt.toLowerCase().includes(q) ||
            h.body.toLowerCase().includes(q) ||
            FORMATO_LABEL[h.formato].toLowerCase().includes(q),
        )
      : HISTORIAS;
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />
      <Toaster position="bottom-center" />

      <main className="pt-24">
        <section className="mx-auto max-w-6xl px-6 py-12 md:px-16 md:py-20">
          <div className="mb-10 flex flex-col items-center text-center md:mb-14">
            <span className="text-label-caps mb-4 text-[10px] font-bold tracking-[0.4em] text-primary md:tracking-[0.5em]">
              MUNDO 02
            </span>
            <h1 className="font-display text-4xl font-extrabold text-on-surface md:text-6xl">
              HISTORIAS
            </h1>
            <p className="font-serif mt-6 max-w-2xl text-base leading-relaxed text-on-surface/60">
              Lugares, comidas, personas, entrevistas y lo que va a redes sociales.
              Historias del camino, no de la carrera.
            </p>

          </div>

          {/* Buscador */}
          <div className="mb-10 mx-auto max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface/40" aria-hidden />
              <Input
                type="text"
                placeholder="Buscar historia..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 bg-surface-container border-outline-variant text-on-surface placeholder:text-on-surface/40 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Mosaico */}
          {historias.length === 0 ? (
            <p className="py-20 text-center text-sm text-on-surface/50">
              No encontramos historias con ese término.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {historias.map((h) => (
                <HistoriaCard key={h.slug} h={h} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function HistoriaCard({ h }: { h: Historia }) {
  const isWide = h.formato === "fotopostal";
  return (
    <Dialog>
      <article
        className={`group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60 ${
          isWide ? "md:col-span-2" : ""
        }`}
      >
        <div
          className={`relative overflow-hidden ${
            isWide ? "aspect-[16/9]" : "aspect-[4/3]"
          }`}
        >
          <img
            src={h.cover}
            alt={h.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <span className="text-label-caps absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 text-[9px] tracking-[0.3em] text-primary">
            {FORMATO_LABEL[h.formato]}
          </span>
          {h.formato === "video" && (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background/70 text-primary">
                ▶
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5 md:p-6">
          <span className="text-label-caps mb-2 text-[10px] font-bold tracking-[0.3em] text-primary">
            {formatDate(h.date).toUpperCase()}
          </span>
          <h2
            className={`font-display font-extrabold leading-tight text-on-surface ${
              isWide ? "text-2xl md:text-3xl" : "text-xl"
            }`}
          >
            {h.title}
          </h2>
          <p className="font-serif mt-3 line-clamp-4 text-sm leading-relaxed text-on-surface/70">
            {h.excerpt}
          </p>


          <div className="mt-5 flex flex-wrap items-center gap-2 pt-3">
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-label-caps inline-flex items-center justify-center bg-primary px-4 py-2 text-[10px] tracking-[0.2em] text-on-primary transition hover:brightness-110"
              >
                CONOCER MÁS
              </button>
            </DialogTrigger>

          </div>
        </div>
      </article>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-outline-variant bg-surface-container p-0">
        <div className="relative aspect-video w-full overflow-hidden">
          <img
            src={h.cover}
            alt={h.title}
            className="h-full w-full object-cover"
          />
          <span className="text-label-caps absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 text-[9px] tracking-[0.3em] text-primary">
            {FORMATO_LABEL[h.formato]}
          </span>
        </div>
        <div className="p-6 md:p-8">
          <DialogHeader>
            <span className="text-label-caps mb-3 text-[10px] font-bold tracking-[0.3em] text-primary">
              {formatDate(h.date).toUpperCase()}
            </span>
            <DialogTitle className="font-display text-2xl font-extrabold leading-tight text-on-surface md:text-3xl">
              {h.title}
            </DialogTitle>
          </DialogHeader>

          {h.formato === "video" && h.videoUrl && (
            <div className="mt-6 aspect-video w-full border border-outline-variant">
              <iframe
                src={h.videoUrl}
                title={h.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}

          <div className="font-serif mt-6 space-y-4 text-base leading-relaxed text-on-surface/80">
            {h.body.split("\n").map((paragraph, idx) =>
              paragraph.trim() ? (
                <p key={idx}>{paragraph.trim()}</p>
              ) : null
            )}
          </div>


        </div>
      </DialogContent>
    </Dialog>
  );
}
