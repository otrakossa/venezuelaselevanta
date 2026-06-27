import { Logo } from "@/components/brand/Logo";
import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer
      className="mt-12 text-[color:var(--cream)]"
      style={{ background: "var(--midnight)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <Logo variant="light" size={32} />
          <p className="text-sm opacity-80">
            Plataforma ciudadana de respuesta al terremoto.
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
                href="/api/reports.geojson"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-90 hover:text-[color:var(--sunrise)] transition-colors"
              >
                Descargar GeoJSON
              </a>
            </li>
            <li>
              <a
                href="/api/reports.csv"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-90 hover:text-[color:var(--sunrise)] transition-colors"
              >
                Descargar CSV (HXL)
              </a>
            </li>
            <li>
              <span className="opacity-40 cursor-not-allowed">
                Documentación API (próximamente)
              </span>
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <div
            className="rounded-lg border border-[color:var(--sunrise)]/40 px-4 py-3 text-sm"
            style={{ background: "rgba(255,107,53,0.08)" }}
          >
            <p className="font-display font-bold uppercase tracking-wide text-[color:var(--sunrise)] text-xs mb-1">
              ⚠ Aviso de responsabilidad
            </p>
            <p className="opacity-95 leading-relaxed text-[13px]">
              Plataforma ciudadana de coordinación.{" "}
              <strong>No nos hacemos responsables por la veracidad</strong> de los reportes
              de terceros. Verifica la información antes de difundirla.
            </p>
          </div>
        </div>
      </div>


    </footer>
  );
}
