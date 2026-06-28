// Centralized Supabase REST credentials for raw fetch() callers.
// HARDCODED to the production project (advebubtfjgxwpjxprok) to match
// src/integrations/supabase/client.ts. We intentionally IGNORE Vite env
// vars because the Lovable preview environment injects the old project's
// VITE_SUPABASE_* values, which would point the REST helpers at stale data
// (e.g. ~510 patients instead of the real ~2.875 in production).

export const SUPA_URL = "https://advebubtfjgxwpjxprok.supabase.co";
export const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDcyMTMsImV4cCI6MjA5ODAyMzIxM30.e4w9nrHsaNRP-enNPS-beZ0Kns7KxvRtVXxRDLECS5U";

