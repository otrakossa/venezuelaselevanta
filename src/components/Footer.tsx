import { Logo } from "@/components/brand/Logo";
import { ExternalLink } from "lucide-react";
import { VisitorCounter } from "@/components/VisitorCounter";
import { SolidarityCounter } from "@/components/SolidarityCounter";

export function Footer() {
  return (
    <footer
      className="mt-12 text-[color:var(--cream)]"
      style={{ background: "var(--midnight)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <span className="inline-block animate-heartbeat">
            <Logo variant="color" size={44} />
          </span>
          <p className="text-sm opacity-80">
            Plataforma&nbsp;abierta y colaborativa para sistematizar la solidaridad
          </p>
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer license"
            className="inline-flex items-center gap-2 rounded border border-white/20 px-2.5 py-1 text-xs hover:text-[color:var(--sunrise)] hover:border-[color:var(--sunrise)] transition-colors"
          >
            <span aria-hidden>🅭🅯</span>
            <span className="font-semibold">CC BY 4.0</span>
          </a>
          <p className="text-xs opacity-60">
            Los datos son de acceso libre. Úsalos, compártelos, atribúyelos.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-display font-bold text-sm uppercase tracking-wide opacity-90">
            Datos abiertos
          </h4>
          <ul className="space-y-1.5 text-sm">
            <li>
              <a
                href="/api"
                className="opacity-90 hover:text-[color:var(--sunrise)] transition-colors font-semibold"
              >
                Documentación API pública →
              </a>
            </li>
            <li>
              <a
                href="/api/reports.geojson"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-90 hover:text-[color:var(--sunrise)] transition-colors"
              >
                Reportes (GeoJSON)
              </a>
            </li>
            <li>
              <a
                href="/api/missing-persons.csv"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-90 hover:text-[color:var(--sunrise)] transition-colors"
              >
                Desaparecidos (CSV+HXL)
              </a>
            </li>
            <li>
              <a
                href="/api/needs.geojson"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-90 hover:text-[color:var(--sunrise)] transition-colors"
              >
                Necesidades (GeoJSON)
              </a>
            </li>
          </ul>

          <p className="text-xs opacity-60 pt-1">
            Compatible con QGIS, ArcGIS, UNOCHA HDX.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-display font-bold text-sm uppercase tracking-wide opacity-90">
            Ecosistema
          </h4>
          <ul className="space-y-1.5 text-sm">
            {[
              { href: "https://data.humdata.org/", label: "HDX — Humanitarian Data Exchange" },
              { href: "https://www.openstreetmap.org/", label: "OpenStreetMap" },
              { href: "https://www.ushahidi.com/", label: "Ushahidi" },
              { href: "https://reliefweb.int/", label: "ReliefWeb / OCHA" },
            ].map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 opacity-90 hover:text-[color:var(--sunrise)] transition-colors"
                >
                  {l.label}
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <VisitorCounter />
            <SolidarityCounter variant="footer" />
          </div>
          <div className="rounded-lg px-4 py-3 text-sm">
            <p className="font-display font-bold uppercase tracking-wide text-[color:var(--sunrise)] text-xs mb-1">
              ⚠ Aviso de responsabilidad
            </p>
            <p className="opacity-95 leading-relaxed text-[13px]">
              Esta plataforma es un espacio abierto y colaborativo, nutrido por el esfuerzo de todas las personas que deciden sumarse. Cada participante es responsable de la información que aporta y comparte. Te invitamos a verificar los datos antes de difundirlos y a ser parte activa de esta red.
            </p>
          </div>
        </div>
      </div>


    </footer>
  );
}
