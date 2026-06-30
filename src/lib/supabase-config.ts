// Fuente única de verdad del proyecto Supabase del NAVEGADOR (build-time).
//
// La selección de ambiente usa una variable PROPIA `VITE_APP_SUPABASE_*` — a
// propósito NO usamos `VITE_SUPABASE_*`, porque el entorno *preview* de Lovable
// inyecta esas con el proyecto VIEJO y apuntaría a data obsoleta. Como Lovable
// no inyecta `VITE_APP_*`, este módulo la ignora y cae a un fallback seguro:
//
//   • dev (`vite dev`, import.meta.env.DEV)  → Supabase LOCAL (`supabase start`)
//   • build de producción (preview + VPS)    → proyecto de PRODUCCIÓN
//
// Resultado: el dev local nunca pega a prod por accidente, y tanto el preview de
// Lovable como el VPS muestran prod aunque la var no esté seteada. Para apuntar
// el dev a leehurg/prod, setear `VITE_APP_SUPABASE_URL` + `_PUBLISHABLE_KEY` en `.env`.
//
// El anon key es público (viaja en el bundle de todos modos), así que vivir aquí
// no agrega exposición.

const PROD_URL = "https://advebubtfjgxwpjxprok.supabase.co";
const PROD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDcyMTMsImV4cCI6MjA5ODAyMzIxM30.e4w9nrHsaNRP-enNPS-beZ0Kns7KxvRtVXxRDLECS5U";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const fallbackUrl = import.meta.env.DEV ? LOCAL_URL : PROD_URL;
const fallbackKey = import.meta.env.DEV ? LOCAL_ANON_KEY : PROD_ANON_KEY;

// `||` (no `??`) para que un valor vacío ("") también caiga al fallback.
export const SUPABASE_URL =
  (import.meta.env.VITE_APP_SUPABASE_URL as string | undefined) || fallbackUrl;
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_APP_SUPABASE_PUBLISHABLE_KEY as string | undefined) || fallbackKey;

// Visibilidad en dev: deja claro a qué DB apunta el navegador (responde "¿cuál DB?").
if (import.meta.env.DEV && typeof console !== "undefined") {
  console.info(`[Supabase] navegador → ${SUPABASE_URL}`);
}
