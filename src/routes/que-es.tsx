import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Heart,
  Map as MapIcon,
  FilePlus,
  Users,
  HeartPulse,
  HandHeart,
  PackageOpen,
  BarChart3,
  Send,
  Database,
  Download,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import heroImage from "@/assets/hero-rescate.jpg";
import { TELEGRAM_BOT } from "@/lib/credits";

export const Route = createFileRoute("/que-es")({
  head: () => ({
    meta: [
      { title: "Qué es Venezuela Se Levanta — Nuestra historia" },
      {
        name: "description",
        content:
          "Venezuela Se Levanta es una plataforma ciudadana que pone la tecnología y los datos al servicio de la respuesta colectiva al terremoto.",
      },
      { property: "og:title", content: "Qué es Venezuela Se Levanta — Nuestra historia" },
      {
        property: "og:description",
        content:
          "Cómo nació, qué puedes hacer y cómo sumarte a esta red ciudadana de respuesta a la crisis.",
      },
      { property: "og:url", content: "https://venezuelaselevanta.info/que-es" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://venezuelaselevanta.info/que-es" }],
  }),
  component: AboutPage,
});

const ACCIONES = [
  {
    to: "/reportar",
    icon: FilePlus,
    title: "Reporta lo que ves",
    desc: "Una calle bloqueada, un derrumbe, una emergencia. Si lo viste, ponlo en el mapa.",
  },
  {
    to: "/desaparecidos",
    icon: Users,
    title: "Busca o registra desaparecidos",
    desc: "Ayuda a reencontrar a quienes están siendo buscados por sus familias.",
  },
  {
    to: "/pacientes",
    icon: HeartPulse,
    title: "Atendidos en centros de salud",
    desc: "Personas registradas en hospitales y refugios, para que sus seres queridos los ubiquen.",
  },
  {
    to: "/necesidades",
    icon: HandHeart,
    title: "Conoce qué hace falta",
    desc: "Agua, medicinas, refugio, manos. Las comunidades publican lo que necesitan.",
  },
  {
    to: "/ofertas",
    icon: PackageOpen,
    title: "Ofrece ayuda concreta",
    desc: "Tienes recursos, transporte o tiempo? Conecta tu ayuda con una necesidad real.",
  },
  {
    to: "/estadisticas",
    icon: BarChart3,
    title: "Estadísticas en tiempo real",
    desc: "Indicadores claros para entender la magnitud y orientar la respuesta.",
  },
  {
    to: "/donar",
    icon: Heart,
    title: "Apoya con una donación",
    desc: "Sostén la operación de la plataforma y a los equipos en terreno.",
  },
] as const;

function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ backgroundColor: "var(--midnight)" }}
      >
        <img
          src={heroImage}
          alt="Voluntarios y comunidad respondiendo a la emergencia en Venezuela"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(13,43,69,0.94) 0%, rgba(13,43,69,0.78) 50%, rgba(13,43,69,0.5) 100%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-[color:var(--cream)]">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-white/80 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al mapa
          </Link>
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] bg-[color:var(--sunrise)]/20 border border-[color:var(--sunrise)]/40 text-[color:var(--gold)] px-2.5 py-1 rounded-full">
            <Sparkles className="h-3 w-3" /> Nuestra historia
          </span>
          <h1 className="font-display text-3xl sm:text-5xl mt-3 leading-tight">
            Venezuela se levanta,
            <br />
            <span className="text-[color:var(--sunrise)]">y lo hacemos juntos.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm sm:text-lg text-white/85 leading-relaxed">
            La tierra se movió, pero Venezuela sigue firme. Esta plataforma existe para que
            nadie tenga que responder solo: aquí ponemos la tecnología y los datos al servicio
            de la solidaridad.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/reportar"
              className="inline-flex items-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-4 py-2 text-sm hover:opacity-90 transition-opacity shadow-md"
            >
              <FilePlus className="h-4 w-4" /> Iniciar un reporte
            </Link>
            <Link
              to="/ofertas"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/30 text-white font-semibold rounded-full px-4 py-2 text-sm hover:bg-white/20 transition-colors"
            >
              <HandHeart className="h-4 w-4" /> Quiero ayudar
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Qué es */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-[color:var(--sunrise)]" />
            <h2 className="font-display text-2xl sm:text-3xl text-[color:var(--midnight)]">
              Qué es Venezuela Se Levanta
            </h2>
          </div>
          <p className="text-base sm:text-lg leading-relaxed text-foreground/90">
            Somos una plataforma ciudadana de respuesta colaborativa frente a la emergencia del
            terremoto en Venezuela. Un lugar abierto, vivo y en tiempo real donde cualquier
            persona puede <strong>reportar lo que ve</strong>, <strong>buscar o registrar
            personas desaparecidas</strong>, ubicar a quienes están siendo{" "}
            <strong>atendidos en hospitales y refugios</strong>, y descubrir qué necesita cada
            comunidad para que la ayuda llegue mejor.
          </p>
          <p className="text-base sm:text-lg leading-relaxed text-foreground/90">
            Todo confluye en un <strong>mapa colaborativo</strong> que crece con cada aporte.
            Cuantas más personas reportan, más clara se vuelve la imagen de la crisis, y más
            certera puede ser la respuesta de voluntarios, organizaciones y autoridades.
          </p>
        </section>

        {/* Cómo nació */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[color:var(--cream)] via-card to-[color:var(--gold)]/15 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--sunrise)]">
            <Sparkles className="h-3.5 w-3.5" /> Cómo nació
          </div>
          <h2 className="font-display text-2xl sm:text-3xl text-[color:var(--midnight)] mt-2">
            De un temblor, una red.
          </h2>
          <div className="mt-4 space-y-3 text-base leading-relaxed text-foreground/90">
            <p>
              Cuando el terremoto sacudió Venezuela, la información empezó a circular fragmentada:
              fotos sueltas, audios, mensajes reenviados. Familias enteras buscando a sus seres
              queridos sin un lugar claro a donde acudir. Voluntarios queriendo ayudar sin saber
              exactamente dónde.
            </p>
            <p>
              Un grupo de personas voluntarias, desarrolladores, activistas del software libre y
              organizaciones aliadas decidió hacer algo. Inspirados por experiencias como{" "}
              <a
                href="https://www.ushahidi.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--sky)] hover:underline font-medium"
              >
                Ushahidi
              </a>{" "}
              y otras plataformas humanitarias del mundo, construyeron en pocos días una
              herramienta abierta para que la información dejara de perderse y la solidaridad
              encontrara caminos.
            </p>
            <p>
              Detrás de esta plataforma hay manos concretas: <strong>Codex Tecnología</strong>,
              la <strong>Fundación Casa del Bosque</strong>, la comunidad de{" "}
              <strong>Activistas por el Software Libre</strong>, equipos de verificación, y miles
              de personas en terreno que reportan, validan y ayudan a difundir.
            </p>
          </div>
        </section>

        {/* Qué puedes hacer */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-[color:var(--sky)]" />
            <h2 className="font-display text-2xl sm:text-3xl text-[color:var(--midnight)]">
              Qué puedes hacer aquí
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Un mismo lugar para coordinar, visibilizar y actuar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACCIONES.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className="group rounded-2xl border border-border bg-card p-4 hover:border-[color:var(--sunrise)]/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-[color:var(--sunrise)]/10 text-[color:var(--sunrise)] flex items-center justify-center mb-3 group-hover:bg-[color:var(--sunrise)] group-hover:text-white transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-display text-base text-[color:var(--midnight)] leading-tight">
                    {a.title}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{a.desc}</p>
                </Link>
              );
            })}
            <a
              href={TELEGRAM_BOT}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-border bg-card p-4 hover:border-[color:var(--sky)]/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-[color:var(--sky)]/10 text-[color:var(--sky)] flex items-center justify-center mb-3 group-hover:bg-[color:var(--sky)] group-hover:text-white transition-colors">
                <Send className="h-5 w-5" />
              </div>
              <div className="font-display text-base text-[color:var(--midnight)] leading-tight">
                Reporta por Telegram
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Sin internet bueno? Usa el bot @VenezuelaSeLevantabot desde tu chat.
              </p>
            </a>
          </div>
        </section>

        {/* Datos abiertos */}
        <section
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-[color:var(--cream)]"
          style={{ background: "var(--midnight)" }}
        >
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--gold)]">
            <Database className="h-3.5 w-3.5" /> Datos abiertos al servicio de todos
          </div>
          <h2 className="font-display text-2xl sm:text-3xl mt-2">
            La información es de la gente.
          </h2>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/80 leading-relaxed">
            Todos los datos de la plataforma están bajo licencia{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer license"
              className="underline decoration-[color:var(--sunrise)] underline-offset-2 hover:text-[color:var(--sunrise)] transition-colors"
            >
              Creative Commons BY 4.0
            </a>
            . Puedes descargarlos, analizarlos, mapearlos y reutilizarlos en formatos GeoJSON
            y CSV (con etiquetas HXL), compatibles con QGIS, ArcGIS y UNOCHA HDX. Pedimos solo
            una cosa: que cites la fuente.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/api/reports.geojson"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-4 py-2 text-sm hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" /> GeoJSON
            </a>
            <a
              href="/api/reports.csv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/30 text-white font-semibold rounded-full px-4 py-2 text-sm hover:bg-white/20 transition-colors"
            >
              <Download className="h-4 w-4" /> CSV (HXL)
            </a>
          </div>
        </section>

        {/* Cómo sumarte */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <HandHeart className="h-5 w-5 text-[color:var(--gold)]" />
            <h2 className="font-display text-2xl sm:text-3xl text-[color:var(--midnight)]">
              Cómo sumarte
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Esto solo funciona si lo hacemos entre todas y todos.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Way
              title="Reporta lo que ves"
              desde="Desde el mapa o el bot de Telegram, con foto y ubicación."
            />
            <Way
              title="Verifica y comenta"
              desde="Confirma reportes cercanos, suma contexto, aporta detalles."
            />
            <Way
              title="Difunde"
              desde="Comparte la plataforma con tu comunidad y redes."
            />
            <Way
              title="Súmate como organización"
              desde="Si representas a un colectivo o institución, escríbenos para coordinar."
            />
          </ul>
          <div className="pt-2 flex flex-wrap gap-2">
            <Link
              to="/creditos"
              hash="contacto"
              className="inline-flex items-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-5 py-2.5 text-sm hover:opacity-90 transition-opacity shadow-md"
            >
              <MessageSquare className="h-4 w-4" /> Escríbenos
            </Link>
            <Link
              to="/creditos"
              className="inline-flex items-center gap-2 bg-white border border-border text-[color:var(--midnight)] font-semibold rounded-full px-5 py-2.5 text-sm hover:border-[color:var(--sunrise)]/50 transition-colors"
            >
              <Heart className="h-4 w-4 text-[color:var(--sunrise)]" /> Ver créditos
            </Link>
          </div>
        </section>

        {/* Cierre */}
        <section className="text-center py-8 sm:py-12">
          <p className="font-display text-2xl sm:text-4xl text-[color:var(--midnight)] leading-tight">
            La tierra se movió,
            <br />
            <span className="text-[color:var(--sunrise)]">
              pero Venezuela sigue firme.
            </span>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Hecho con <Heart className="inline h-3 w-3 text-[color:var(--sunrise)]" /> por gente
            como tú · venezuelaselevanta.info
          </p>
        </section>
      </div>
    </div>
  );
}

function Way({ title, desde }: { title: string; desde: string }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 hover:border-[color:var(--sunrise)]/40 transition-colors">
      <div className="font-semibold text-sm text-[color:var(--midnight)]">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desde}</div>
    </li>
  );
}
