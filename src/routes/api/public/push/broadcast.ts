import { createFileRoute } from "@tanstack/react-router";

// VAPID JWT signing using Web Crypto (Workers-compatible — no node deps).
function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let s = "";
  for (const c of bytes) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function importVapidKey(d: string, x: string, y: string): Promise<CryptoKey> {
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d, x, y, key_ops: ["sign"], ext: true };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function buildVapidAuthHeader(audience: string): Promise<string> {
  const subject = process.env.VAPID_SUBJECT!;
  const d = process.env.VAPID_PRIVATE_KEY!;
  const x = process.env.VAPID_PUBLIC_X!;
  const y = process.env.VAPID_PUBLIC_Y!;
  const publicKey = process.env.VAPID_PUBLIC_KEY!;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };
  const unsigned = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
  const key = await importVapidKey(d, x, y);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64urlEncode(sigBuf)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const Route = createFileRoute("/api/public/push/broadcast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PUSH_BROADCAST_SECRET;
        const provided = request.headers.get("x-broadcast-secret");
        if (!secret || provided !== secret) {
          return new Response("forbidden", { status: 403 });
        }

        let body: { report_id?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        if (!body.report_id) return new Response("missing report_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: report, error: rErr } = await supabaseAdmin
          .from("reports")
          .select("id, title, description, lat, lng, address, urgency, category_id")
          .eq("id", body.report_id)
          .maybeSingle();

        if (rErr || !report) {
          return Response.json({ ok: false, error: "report not found" }, { status: 404 });
        }
        const r = report as {
          id: string;
          title: string | null;
          description: string | null;
          lat: number | null;
          lng: number | null;
          address: string | null;
        };

        const { data: subs, error: sErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth, lat, lng, radius_km");

        if (sErr) return Response.json({ ok: false, error: sErr.message }, { status: 500 });

        const targets = (subs ?? []).filter((s: any) => {
          if (s.lat == null || s.lng == null) return true;
          if (r.lat == null || r.lng == null) return true;
          const dist = haversineKm(s.lat, s.lng, r.lat, r.lng);
          return dist <= (s.radius_km ?? 10);
        });

        const notifPayload = JSON.stringify({
          title: `🚨 Emergencia: ${r.title?.slice(0, 60) ?? "Reporte crítico"}`,
          body: r.address || r.description?.slice(0, 120) || "Toca para ver el detalle.",
          url: `/?report=${r.id}`,
          tag: `report-${r.id}`,
        });

        const sent: { endpoint: string; status: number }[] = [];
        const toDelete: string[] = [];

        await Promise.all(
          targets.map(async (s) => {
            try {
              const u = new URL(s.endpoint);
              const audience = `${u.protocol}//${u.host}`;
              const auth = await buildVapidAuthHeader(audience);

              const res = await fetch(s.endpoint, {
                method: "POST",
                headers: {
                  Authorization: auth,
                  "Content-Type": "application/octet-stream",
                  "Content-Encoding": "aes128gcm",
                  TTL: "86400",
                  Urgency: "high",
                },
                // NOTE: payload is sent UNENCRYPTED-as-empty; push services accept
                // empty bodies. The client SW handler treats missing payload as a
                // generic title. For encrypted payloads we'd need full RFC8291 impl.
                body: new Uint8Array(0),
              });

              sent.push({ endpoint: s.endpoint, status: res.status });
              if (res.status === 404 || res.status === 410) toDelete.push(s.endpoint);
            } catch (e) {
              sent.push({ endpoint: s.endpoint, status: 0 });
            }
          }),
        );

        if (toDelete.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", toDelete);
        }

        return Response.json({ ok: true, total: targets.length, sent, notifPayload });
      },
    },
  },
});
