import { ESTADOS, MUNICIPIOS } from "@/lib/venezuela-divipol";

type Props = {
  state: string;
  municipality: string;
  parish: string;
  onChange: (v: { state: string; municipality: string; parish: string }) => void;
  className?: string;
  required?: boolean;
};

/**
 * Selects en cascada Estado → Municipio + input libre para Parroquia.
 * Todos los campos son opcionales por defecto.
 */
export function LocationSelect({ state, municipality, parish, onChange, className, required }: Props) {
  const field =
    "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const label = "text-xs font-semibold text-foreground mb-1 block";
  const municipios = state && MUNICIPIOS[state] ? MUNICIPIOS[state] : [];

  return (
    <div className={className ?? "grid grid-cols-1 sm:grid-cols-3 gap-3"}>
      <div>
        <label className={label}>Estado {required && <span className="text-[color:var(--sunrise)]">*</span>}</label>
        <select
          className={field}
          value={state}
          required={required}
          onChange={(e) => onChange({ state: e.target.value, municipality: "", parish: "" })}
        >
          <option value="">— Selecciona —</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Municipio</label>
        <select
          className={field}
          value={municipality}
          disabled={!state}
          onChange={(e) => onChange({ state, municipality: e.target.value, parish: "" })}
        >
          <option value="">{state ? "— Selecciona —" : "Elige estado"}</option>
          {municipios.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Parroquia</label>
        <input
          className={field}
          value={parish}
          placeholder={municipality ? "Ej: Catedral" : "—"}
          disabled={!municipality}
          maxLength={80}
          onChange={(e) => onChange({ state, municipality, parish: e.target.value })}
        />
      </div>
    </div>
  );
}
