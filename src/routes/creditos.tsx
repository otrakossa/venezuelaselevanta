import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ExternalLink, Mail, Send, ArrowLeft } from "lucide-react";
import { team, collaborators, organizations, tech, CONTACT_EMAIL, TELEGRAM_BOT, type Person, type Organization } from "@/lib/credits";

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
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al mapa
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[color:var(--sunrise)] via-[color:var(--gold)] to-[color:var(--sky)] p-6 sm:p-10 text-white shadow-xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
          <Heart className="h-4 w-4" /> Gracias
        </div>
        <h1 className="font-display text-3xl sm:text-5xl mt-2 leading-tight">
          Hecho por la gente,<br />para la gente.
        </h1>
        <p className="mt-3 max-w-2xl text-white/90 text-sm sm:text-base">
          Venezuela Se Levanta es posible gracias a personas voluntarias, organizaciones
          aliadas y tecnología abierta. Si quieres sumarte, hay lugar para ti.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 bg-white text-[color:var(--midnight)] font-semibold rounded-full px-4 py-2 text-sm hover:bg-white/90 transition-colors"
          >
            <Mail className="h-4 w-4" /> Quiero colaborar
          </a>
          <a
            href={TELEGRAM_BOT}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-[color:var(--midnight)]/30 backdrop-blur border border-white/40 text-white font-semibold rounded-full px-4 py-2 text-sm hover:bg-[color:var(--midnight)]/50 transition-colors"
          >
            <Send className="h-4 w-4" /> Bot de Telegram
          </a>
        </div>
      </section>

      {/* Equipo */}
      <Section title="Equipo core" subtitle="Quienes mantienen y desarrollan la plataforma.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {team.map((p) => (
            <PersonCard key={p.name} person={p} large />
          ))}
        </div>
      </Section>

      {/* Colaboradores */}
      <Section
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
        title="Tecnología y datos abiertos"
        subtitle="Construido sobre proyectos libres y abiertos."
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tech.map((t) => (
            <li
              key={t.name}
              className="rounded-xl border border-border bg-card p-3 flex items-start gap-3"
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
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-display text-2xl text-[color:var(--midnight)]">¿Cómo puedes ayudar?</h2>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Help title="Reporta lo que ves" desc="Desde la web o el bot de Telegram, con foto y ubicación." />
          <Help title="Verifica reportes" desc="Únete al equipo de moderación y valida información." />
          <Help title="Difunde" desc="Comparte la plataforma con tu comunidad." />
          <Help title="Organización aliada" desc="Escríbenos para coordinar respuesta y aparecer aquí." />
        </ul>
        <div className="mt-5">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-5 py-2.5 text-sm hover:opacity-90 transition-opacity"
          >
            <Mail className="h-4 w-4" /> {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Hecho con <Heart className="inline h-3 w-3 text-[color:var(--sunrise)]" /> en Venezuela ·{" "}
        venezuelaselevanta.info
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl text-[color:var(--midnight)]">{title}</h2>
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
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div
        className={
          (large ? "h-14 w-14 text-base " : "h-11 w-11 text-sm ") +
          "rounded-full bg-gradient-to-br from-[color:var(--sunrise)] to-[color:var(--gold)] text-white font-display flex items-center justify-center shrink-0"
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
  const content = (
    <div className="rounded-xl border border-border bg-card p-4 h-full flex flex-col gap-2 hover:border-[color:var(--sunrise)]/50 hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[color:var(--gold)]/20 text-[color:var(--midnight)] flex items-center justify-center font-display text-sm shrink-0">
          {org.logo ? (
            <img src={org.logo} alt={org.name} className="h-full w-full object-contain p-1" />
          ) : (
            org.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="font-semibold text-sm flex-1 min-w-0 truncate">{org.name}</div>
        {org.url && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      {org.description && <p className="text-xs text-muted-foreground">{org.description}</p>}
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
    <li className="rounded-lg bg-secondary/60 p-3">
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </li>
  );
}
