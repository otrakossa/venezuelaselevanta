import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ExternalLink, Send, ArrowLeft, Users, Building2, Code2, HandHeart, MessageSquare } from "lucide-react";
import { team, collaborators, organizations, tech, TELEGRAM_BOT, type Person, type Organization } from "@/lib/credits";
import { ContactForm } from "@/components/ContactForm";
import heroImage from "@/assets/hero-rescate.jpg";

export const Route = createFileRoute("/creditos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Créditos y Colaboradores — Venezuela Se Levanta" },
      {
        name: "description",
        content:
          "Equipo, voluntarios, organizaciones aliadas y tecnología abierta detrás de Venezuela Se Levanta.",
      },
      { property: "og:title", content: "Créditos y Colaboradores — Venezuela Se Levanta" },
      {
        property: "og:description",
        content: "Gracias a quienes hacen posible esta plataforma colaborativa de crisis.",
      },
    ],
  }),
  component: CreditsPage,
});

function CreditsPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ backgroundColor: "var(--midnight)" }}
      >
        <img
          src={heroImage}
          alt="Comunidad venezolana"
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
            <Heart className="h-3 w-3" /> Gracias
          </span>
          <h1 className="font-display text-3xl sm:text-5xl mt-3 leading-tight">
            Hecho por la gente,
            <br />
            <span className="text-[color:var(--sunrise)]">para la gente.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/80">
            Venezuela Se Levanta es posible gracias a personas voluntarias, organizaciones
            aliadas y tecnología abierta. Si quieres sumarte, hay lugar para ti.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="#contacto"
              className="inline-flex items-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-4 py-2 text-sm hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="h-4 w-4" /> Quiero colaborar
            </a>
            <a
              href={TELEGRAM_BOT}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/30 text-white font-semibold rounded-full px-4 py-2 text-sm hover:bg-white/20 transition-colors"
            >
              <Send className="h-4 w-4" /> Bot de Telegram
            </a>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Equipo */}
        <Section
          icon={<Users className="h-5 w-5 text-[color:var(--sunrise)]" />}
          title="Equipo core"
          subtitle="Quienes mantienen y desarrollan la plataforma."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((p) => (
              <PersonCard key={p.name} person={p} large />
            ))}
          </div>
        </Section>

        {/* Colaboradores */}
        <Section
          icon={<HandHeart className="h-5 w-5 text-[color:var(--gold)]" />}
          title="Colaboradores"
          subtitle="Voluntarios, verificadores y comunidad que aporta día a día."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {collaborators.map((p) => (
              <PersonCard key={p.name} person={p} />
            ))}
          </div>
        </Section>

        {/* Organizaciones */}
        <Section
          icon={<Building2 className="h-5 w-5 text-[color:var(--sky)]" />}
          title="Organizaciones aliadas"
          subtitle="Instituciones y colectivos que apoyan la respuesta."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {organizations.map((o) => (
              <OrgCard key={o.name} org={o} />
            ))}
          </div>
        </Section>

        {/* Tecnología */}
        <Section
          icon={<Code2 className="h-5 w-5 text-[color:var(--midnight)]" />}
          title="Tecnología y datos abiertos"
          subtitle="Construido sobre proyectos libres y abiertos."
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tech.map((t) => (
              <li
                key={t.name}
                className="rounded-xl border border-border bg-card p-3 flex items-start gap-3 hover:border-[color:var(--sky)]/40 hover:shadow-md transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-[color:var(--sky)]/10 text-[color:var(--sky)] flex items-center justify-center font-display text-sm shrink-0">
                  {t.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-sm inline-flex items-center gap-1 hover:text-[color:var(--sunrise)] transition-colors"
                  >
                    {t.name} <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* Cómo unirse */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[color:var(--cream)] via-card to-[color:var(--gold)]/10 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--sunrise)]">
            <HandHeart className="h-3.5 w-3.5" /> Súmate
          </div>
          <h2 className="font-display text-2xl sm:text-3xl text-[color:var(--midnight)] mt-2">
            ¿Cómo puedes ayudar?
          </h2>
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Help title="Reporta lo que ves" desc="Desde la web o el bot de Telegram, con foto y ubicación." />
            <Help title="Verifica reportes" desc="Únete al equipo de moderación y valida información." />
            <Help title="Difunde" desc="Comparte la plataforma con tu comunidad." />
            <Help title="Organización aliada" desc="Escríbenos para coordinar respuesta y aparecer aquí." />
          </ul>
          <div className="mt-6">
            <a
              href="#contacto"
              className="inline-flex items-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-5 py-2.5 text-sm hover:opacity-90 transition-opacity shadow-md"
            >
              <MessageSquare className="h-4 w-4" /> Escríbenos
            </a>
          </div>
        </section>

        {/* Formulario de contacto */}
        <Section
          icon={<MessageSquare className="h-5 w-5 text-[color:var(--sunrise)]" />}
          title="Contacto"
          subtitle="Envíanos un mensaje y te responderemos pronto."
        >
          <div id="contacto" className="scroll-mt-20">
            <ContactForm />
          </div>
        </Section>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Hecho con <Heart className="inline h-3 w-3 text-[color:var(--sunrise)]" /> en Venezuela ·{" "}
          venezuelaselevanta.info
        </p>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-2xl sm:text-3xl text-[color:var(--midnight)]">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground mt-1 mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}

function PersonCard({ person, large }: { person: Person; large?: boolean }) {
  const initials =
    person.initials ??
    person.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  return (
    <div className="group rounded-xl border border-border bg-card p-3 flex items-center gap-3 hover:border-[color:var(--sunrise)]/40 hover:shadow-md transition-all">
      <div
        className={
          (large ? "h-14 w-14 text-base " : "h-11 w-11 text-sm ") +
          "rounded-full bg-gradient-to-br from-[color:var(--sunrise)] to-[color:var(--gold)] text-white font-display flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform"
        }
      >
        {person.avatar ? (
          <img src={person.avatar} alt={person.name} className="h-full w-full rounded-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{person.name}</div>
        <div className="text-xs text-muted-foreground truncate">{person.role}</div>
        {person.links && person.links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {person.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[color:var(--sky)] hover:underline inline-flex items-center gap-0.5"
              >
                {l.label} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgCard({ org }: { org: Organization }) {
  const initials = org.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const content = (
    <div className="rounded-xl border border-border bg-card p-4 h-full flex flex-col gap-3 hover:border-[color:var(--sunrise)]/50 hover:shadow-lg transition-all group">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[color:var(--gold)]/30 to-[color:var(--sunrise)]/20 text-[color:var(--midnight)] flex items-center justify-center font-display text-sm shrink-0 overflow-hidden ring-1 ring-border group-hover:scale-105 transition-transform">
          {org.logo ? (
            <img
              src={org.logo}
              alt={org.name}
              className="h-full w-full object-contain p-1.5 bg-white"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{org.name}</div>
          {org.url && (
            <div className="text-[11px] text-[color:var(--sky)] inline-flex items-center gap-0.5 truncate">
              Visitar <ExternalLink className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
      </div>
      {org.description && <p className="text-xs text-muted-foreground leading-relaxed">{org.description}</p>}
    </div>
  );
  return org.url ? (
    <a href={org.url} target="_blank" rel="noreferrer" className="block h-full">
      {content}
    </a>
  ) : (
    content
  );
}

function Help({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="rounded-lg bg-white/70 dark:bg-card/70 backdrop-blur border border-border/60 p-3 hover:border-[color:var(--sunrise)]/40 transition-colors">
      <div className="font-semibold text-sm text-[color:var(--midnight)]">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </li>
  );
}
