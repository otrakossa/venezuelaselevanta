import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, PUSH_SW_URL, PUSH_SW_SCOPE } from "./push-config";

const STORAGE_KEY = "vsl.push.endpoint.v1";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const b = new Uint8Array(buf);
  let s = "";
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getStoredEndpoint(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  // Register the dedicated push SW with its own narrow scope, separate from the PWA SW.
  const reg = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE });
  await navigator.serviceWorker.ready;
  return reg;
}

export type PushPrefs = { lat?: number; lng?: number; radius_km: number };

export async function subscribePush(prefs: PushPrefs): Promise<{ endpoint: string }> {
  if (!isPushSupported()) throw new Error("Tu navegador no soporta notificaciones push");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permiso de notificaciones denegado");

  const reg = await getPushRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    });
  }
  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh ?? bufToB64Url(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? bufToB64Url(sub.getKey("auth"));

  // Upsert via server route (uses service role; RLS restricts client-side UPDATE).
  const res = await fetch("/api/public/push/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upsert",
      endpoint,
      p256dh,
      auth,
      lat: prefs.lat ?? null,
      lng: prefs.lng ?? null,
      radius_km: prefs.radius_km,
      user_agent: navigator.userAgent.slice(0, 200),
    }),
  });
  if (!res.ok) throw new Error("No se pudo guardar la suscripción");

  localStorage.setItem(STORAGE_KEY, endpoint);
  return { endpoint };
}

export async function unsubscribePush(): Promise<void> {
  const endpoint = getStoredEndpoint();
  try {
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (_) {}
  if (endpoint) {
    await fetch("/api/public/push/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", endpoint }),
    });
    localStorage.removeItem(STORAGE_KEY);
  }
}
