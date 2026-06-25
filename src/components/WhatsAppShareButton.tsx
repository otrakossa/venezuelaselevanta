import type { Report } from "@/lib/types";
import { CATEGORY_MAP, URGENCY_LABELS } from "@/lib/categories";
import { cn } from "@/lib/utils";

const WA_GREEN = "#25D366";

function buildLink(report: Report): string {
  const cat = CATEGORY_MAP[report.category];
  const urgency = URGENCY_LABELS[report.urgency]?.label ?? report.urgency;
  const desc = (report.description ?? "").trim().slice(0, 200);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://venezuelaselevanta.info";
  const url = `${origin.replace(/\/$/, "")}/reportes/${report.id}`;
  const lines = [
    `🚨 ${report.title}`,
    "",
    `📍 ${report.address || "Sin dirección especificada"}`,
    `🏷️ Categoría: ${cat?.name ?? report.category}`,
    `⚠️ Urgencia: ${urgency}`,
    "",
    desc,
    "",
    `Ver en el mapa: ${url}`,
    "",
    "Reportado en venezuelaselevanta.info",
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="currentColor">
      <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39-.043 0-.087-.005-.13-.022-.876-.225-1.766-.823-2.502-1.55-.736-.727-1.337-1.617-1.553-2.493-.018-.043-.024-.087-.024-.13 0-.43 1.39-1.146 1.39-1.518 0-.078-.022-.156-.065-.221-.108-.221-1.146-2.764-1.59-2.764-.221 0-.43.043-.65.087-.394.087-1.302 1.105-1.302 2.067 0 .908.426 1.85.752 2.408 1.232 2.107 3.011 3.886 5.118 5.118.558.326 1.5.752 2.408.752.962 0 1.98-.908 2.067-1.302.044-.22.087-.43.087-.65 0-.444-2.543-1.482-2.764-1.59-.065-.043-.143-.065-.221-.065zm-3.061 9.044a10.99 10.99 0 0 1-5.51-1.485l-.395-.236-4.092 1.073 1.092-3.991-.258-.41a10.99 10.99 0 0 1-1.69-5.882c0-6.067 4.937-11.004 11.004-11.004 2.941 0 5.704 1.144 7.78 3.225a10.95 10.95 0 0 1 3.224 7.788c0 6.067-4.937 11.004-11.004 11.004zm9.36-20.357C22.91 3.295 19.595 1.917 16.043 1.917 8.74 1.917 2.789 7.866 2.789 15.17c0 2.333.61 4.611 1.77 6.62L2.68 30.083l8.464-2.222a13.21 13.21 0 0 0 6.319 1.61h.007c7.302 0 13.253-5.95 13.253-13.252 0-3.546-1.378-6.863-3.879-9.366z"/>
    </svg>
  );
}

interface Props {
  report: Report;
  variant?: "icon" | "full" | "compact";
  className?: string;
}

export function WhatsAppShareButton({ report, variant = "full", className }: Props) {
  const href = buildLink(report);
  const common = "inline-flex items-center justify-center gap-1.5 font-semibold transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1";
  if (variant === "icon") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartir en WhatsApp"
        title="Compartir en WhatsApp"
        className={cn(common, "h-8 w-8 rounded-full text-white shadow-sm", className)}
        style={{ background: WA_GREEN }}
        onClick={(e) => e.stopPropagation()}
      >
        <WhatsAppIcon className="h-4 w-4" />
      </a>
    );
  }
  if (variant === "compact") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(common, "px-2.5 py-1.5 rounded-md text-white text-[11px]", className)}
        style={{ background: WA_GREEN }}
        onClick={(e) => e.stopPropagation()}
      >
        <WhatsAppIcon className="h-3.5 w-3.5" />
        WhatsApp
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(common, "w-full px-4 py-2.5 rounded-lg text-white text-sm shadow-sm", className)}
      style={{ background: WA_GREEN }}
      onClick={(e) => e.stopPropagation()}
    >
      <WhatsAppIcon className="h-4 w-4" />
      Compartir en WhatsApp
    </a>
  );
}
