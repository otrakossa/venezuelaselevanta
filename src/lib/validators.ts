// Máscaras de entrada y validadores para cédula y teléfono venezolanos.
// Funciones puras y reutilizables (necesidades, ofertas, pacientes).
// El `onChange` de cada input pasa el valor por la máscara → el campo fuerza el
// formato mientras se escribe; `submit()` revalida con los `isValid*`.

/** Devuelve solo los dígitos de un string. */
export function onlyDigits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

// ── Cédula / documento ────────────────────────────────────────────────
// Un solo campo: el usuario escribe V, E o P (pasaporte) al inicio; la máscara
// pone el guion y bloquea caracteres inválidos.
//  - V / E → solo dígitos (V-12345678)
//  - P     → alfanumérico (P-AB123456)

/**
 * Enmascara cédula/documento a `${PREFIJO}-${CUERPO}`.
 * Prefijo = V/E/P; si empieza por dígito asume V; otra letra al inicio se ignora.
 */
export function maskCedula(raw: string): string {
  const chars = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!chars) return "";

  let prefix: string;
  let bodyRaw: string;
  if (chars[0] === "V" || chars[0] === "E" || chars[0] === "P") {
    prefix = chars[0];
    bodyRaw = chars.slice(1);
  } else if (/[0-9]/.test(chars[0])) {
    prefix = "V"; // conveniencia: el caso más común
    bodyRaw = chars;
  } else {
    return ""; // letra inicial inválida
  }

  const body =
    prefix === "P"
      ? bodyRaw.slice(0, 15) // pasaporte: alfanumérico
      : bodyRaw.replace(/[^0-9]/g, "").slice(0, 8); // V/E: solo dígitos

  return body ? `${prefix}-${body}` : `${prefix}-`;
}

/** Cédula válida: `V-`/`E-` + 6–8 dígitos, o `P-` + 5–15 alfanuméricos. */
export function isValidCedula(v: string): boolean {
  const s = (v ?? "").trim().toUpperCase();
  return /^[VE]-\d{6,8}$/.test(s) || /^P-[A-Z0-9]{5,15}$/.test(s);
}

// ── Teléfono ──────────────────────────────────────────────────────────
// Campo con `+` y prefijo editable (default +58). Solo dígitos tras el `+`
// (el `+` es el único carácter no numérico permitido). Acepta internacionales.

/** Valor inicial sugerido del campo teléfono. */
export const PHONE_DEFAULT = "+58 ";

/**
 * Enmascara a `+CC NNNNNNN…`. Agrupa con un espacio tras el código de país
 * (2 dígitos por defecto, calza con +58; para otros códigos es solo cosmético).
 */
export function maskPhone(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 15);
  if (!digits) return "+";
  if (digits.length <= 2) return `+${digits}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
}

/** El campo solo tiene el código de país (o menos) → se trata como vacío. */
export function phoneIsEmpty(v: string): boolean {
  return onlyDigits(v).length <= 2;
}

/** Teléfono válido: `+` seguido de 8 a 15 dígitos (E.164). */
export function isValidPhone(v: string): boolean {
  const s = (v ?? "").trim();
  const d = onlyDigits(s);
  return s.startsWith("+") && d.length >= 8 && d.length <= 15;
}

export const CEDULA_ERROR =
  "Documento inválido. Usa V-12345678 (o E-… / P-… para pasaporte).";
export const PHONE_ERROR =
  "Teléfono inválido. Usa el formato +58 4141234567 (con código de país).";
