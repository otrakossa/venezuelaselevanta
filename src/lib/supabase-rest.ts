// Centralized Supabase REST credentials for raw fetch() callers.
// Mirrors the hardcoded values in src/integrations/supabase/client.ts so that
// routes/components calling the REST API directly don't break when Vite
// env vars (VITE_SUPABASE_*) aren't injected into the build.

const HARDCODED_URL = "https://advebubtfjgxwpjxprok.supabase.co";
const HARDCODED_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDcyMTMsImV4cCI6MjA5ODAyMzIxM30.e4w9nrHsaNRP-enNPS-beZ0Kns7KxvRtVXxRDLECS5U";

const envUrl =
  (typeof import.meta !== "undefined" && (import.meta.env?.VITE_SUPABASE_URL as string | undefined)) || "";
const envKey =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)) || "";

export const SUPA_URL = envUrl || HARDCODED_URL;
export const SUPA_ANON = envKey || HARDCODED_ANON;
