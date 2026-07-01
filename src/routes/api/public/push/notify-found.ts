import { createFileRoute } from "@tanstack/react-router";

// VAPID JWT signing — mirrors /api/public/push/broadcast (Workers-compatible).
function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let s = "";
  for (const c of bytes) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject };
  const unsigned = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
  const key = await importVapidKey(d, x, y);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64urlEncode(sigBuf)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

export const Route = createFileRoute("/api/public/push/notify-found")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PUSH_BROADCAST_SECRET;
        const provided = request.headers.get("x-broadcast-secret");
        if (!secret || provided !== secret) return new Response("forbidden", { status: 403 });

        let body: { missing_id?: string };
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
        if (!body.missing_id) return new Response("missing missing_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: person, error: pErr } = await (supabaseAdmin.from("missing_persons") as unknown as {
          select: (cols: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } };
        })
          .select("id, name, outcome, outcome_note, last_seen_location")
          .eq("id", body.missing_id)
          .maybeSingle();

        if (pErr || !person) return Response.json({ ok: false, error: "person not found" }, { status: 404 });
        const p = person as { id: string; name: string; outcome: string | null; outcome_note: string | null; last_seen_location: string | null };

        const { data: subs, error: sErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth");
        if (sErr) return Response.json({ ok: false, error: sErr.message }, { status: 500 });

        const outcomeLabel: Record<string, string> = {
          at_health_center: "atendido en centro de salud",
          with_family: "con su familia",
          relocated: "en lugar seguro",
          deceased: "fallecido",
          other: "encontrado",
        };
        const status = p.outcome ? outcomeLabel[p.outcome] ?? "encontrado" : "encontrado";

        const notifPayload = JSON.stringify({
          title: `💚 ${p.name} fue encontrado(a)`,
          body: `Estado: ${status}${p.outcome_note ? ` — ${p.outcome_note.slice(0, 80)}` : ""}`,
          url: `/desaparecidos?person=${p.id}`,
          tag: `missing-found-${p.id}`,
        });

        const sent: { endpoint: string; status: number }[] = [];
        const toDelete: string[] = [];

        await Promise.all(
          (subs ?? []).map(async (s: { endpoint: string }) => {
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
                  Urgency: "normal",
                },
                body: new Uint8Array(0),
              });
              sent.push({ endpoint: s.endpoint, status: res.status });
              if (res.status === 404 || res.status === 410) toDelete.push(s.endpoint);
            } catch {
              sent.push({ endpoint: s.endpoint, status: 0 });
            }
          }),
        );

        if (toDelete.length) await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", toDelete);
        return Response.json({ ok: true, total: (subs ?? []).length, sent, notifPayload });
      },
    },
  },
});
