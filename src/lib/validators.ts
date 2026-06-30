// Validadores de formato para cédula y teléfono venezolanos.
// Funciones puras y reutilizables (necesidades, ofertas, pacientes).

/** Devuelve solo los dígitos de un string. */
export function onlyDigits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Cédula venezolana: prefijo opcional V/E (venezolano/extranjero),
 * separadores opcionales (puntos, guiones, espacios) y 6 a 9 dígitos.
 * Acepta: "V-12.345.678", "V12345678", "12345678", "E-1234567".
 */
export function isValidCedula(raw: string): boolean {
  const s = (raw ?? "").trim();
  if (!s) return false;
  // quita un prefijo V/E opcional y deja solo dígitos
  const digits = onlyDigits(s.replace(/^[VEve]/, ""));
  return digits.length >= 6 && digits.length <= 9;
}

/**
 * Teléfono venezolano. Normaliza a dígitos y acepta:
 *  - 11 dígitos que empiezan en 0  (móvil 04xx o fijo 0xxx) → "04141234567"
 *  - 12 dígitos que empiezan en 58 (formato internacional +58) → "584141234567"
 *  - 10 dígitos que empiezan en 4  (móvil sin el 0 inicial) → "4141234567"
 */
export function isValidVePhone(raw: string): boolean {
  const d = onlyDigits(raw ?? "");
  if (d.length === 11) return d.startsWith("0");
  if (d.length === 12) return d.startsWith("58");
  if (d.length === 10) return d.startsWith("4");
  return false;
}

export const CEDULA_ERROR = "Cédula inválida. Ingresa solo los dígitos (ej. V-12345678).";
export const PHONE_ERROR =
  "Teléfono inválido. Usa el formato 04141234567 (11 dígitos) o +58.";
