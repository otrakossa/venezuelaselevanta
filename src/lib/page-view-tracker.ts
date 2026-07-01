// Tracks a single unique visit per device per day (Venezuela timezone).
// Uses sessionStorage so we don't insert on every route change, and a
// per-day localStorage marker so repeated sessions the same day skip.
import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";
import { getDeviceId } from "@/lib/device-id";

const SESSION_KEY = "vsl-pv-sent";
const DAY_KEY = "vsl-pv-day";

function todayCaracas(): string {
  // YYYY-MM-DD in America/Caracas (UTC-4)
  const now = new Date();
  const cc = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return cc.toISOString().slice(0, 10);
}

export async function trackPageView(path: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const day = todayCaracas();
    if (sessionStorage.getItem(SESSION_KEY) === day) return;
    if (localStorage.getItem(DAY_KEY) === day) {
      sessionStorage.setItem(SESSION_KEY, day);
      return;
    }
    const device_id = getDeviceId();
    if (!device_id) return;
    const referrer = document.referrer && !document.referrer.includes(location.host)
      ? document.referrer.slice(0, 300)
      : null;
    await fetch(`${SUPA_URL}/rest/v1/page_views`, {
      method: "POST",
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
        "Content-Type": "application/json",
        // No usamos `resolution=ignore-duplicates` porque activa ON CONFLICT
        // en PostgREST y eso requiere política SELECT para anon (leak). La
        // colisión por unique (device_id, day) devuelve 409 y se ignora en
        // el catch — es exactamente el comportamiento deseado.
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ device_id, path: path.slice(0, 200), referrer }),
      keepalive: true,
    });
    sessionStorage.setItem(SESSION_KEY, day);
    localStorage.setItem(DAY_KEY, day);
  } catch {
    /* silent */
  }
}
