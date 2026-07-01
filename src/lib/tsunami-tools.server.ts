// Tsunami agent tools — read/write Supabase via REST (no createClient on server).
import { tool } from "ai";
import { z } from "zod";
import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";

const HEADERS = {
  apikey: SUPA_ANON,
  Authorization: `Bearer ${SUPA_ANON}`,
  "Content-Type": "application/json",
};

const SITE = "https://venezuelaselevanta.info";

async function supaGet(path: string): Promise<unknown> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}
async function supaPost(path: string, body: unknown, prefer = "return=representation"): Promise<unknown> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}
async function supaRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${await res.text()}`);
  return res.json();
}

// Escape reserved chars for PostgREST .or() values.
function esc(v: string) {
  return v.replace(/[(),]/g, " ").trim();
}

function normalizeNameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

const PUBLIC_COLS =
  "id,name,age,id_number,description,last_seen_location,state,municipality,parish,photo_url,status,report_date";

export const tsunamiTools = {
  search_missing_persons: tool({
    description:
      "Busca personas desaparecidas por nombre/apellido o por número de cédula. Devuelve hasta 10 fichas con datos públicos.",
    inputSchema: z.object({
      query: z.string().optional().describe("Nombre y/o apellido. Opcional si se pasa id_number."),
      id_number: z.string().optional().describe("Cédula exacta. Tiene prioridad sobre query."),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async ({ query, id_number, limit = 10 }) => {
      let path = `missing_persons?select=${PUBLIC_COLS}&limit=${limit}&order=report_date.desc`;
      if (id_number && id_number.trim()) {
        path += `&id_number=eq.${encodeURIComponent(id_number.trim())}`;
      } else if (query && query.trim()) {
        const q = esc(query);
        const tokens = q.split(/\s+/).filter(Boolean).slice(0, 4);
        // Match all tokens as substrings in name (ilike AND)
        for (const t of tokens) {
          path += `&name=ilike.${encodeURIComponent(`*${t}*`)}`;
        }
      } else {
        return { error: "Debes pasar query o id_number." };
      }
      const rows = (await supaGet(path)) as Array<Record<string, unknown>>;
      return {
        count: rows.length,
        results: rows.map((r) => ({
          id: r.id,
          name: r.name,
          age: r.age,
          id_number: r.id_number,
          state: r.state,
          municipality: r.municipality,
          status: r.status,
          photo_url: r.photo_url,
          url: `${SITE}/desaparecidos?person=${r.id}`,
        })),
      };
    },
  }),

  get_missing_person: tool({
    description: "Obtiene la ficha pública completa de una persona desaparecida por id.",
    inputSchema: z.object({ id: z.string().uuid() }),
    execute: async ({ id }) => {
      const rows = (await supaGet(
        `missing_persons?select=${PUBLIC_COLS}&id=eq.${id}&limit=1`,
      )) as Array<Record<string, unknown>>;
      if (rows.length === 0) return { error: "No encontrado" };
      return { ...rows[0], url: `${SITE}/desaparecidos?person=${id}` };
    },
  }),

  suggest_patient_matches: tool({
    description:
      "Busca coincidencias entre una persona desaparecida y pacientes atendidos en centros médicos. Devuelve nivel de confianza (alta/media/baja) y motivos concretos por los que coincide.",
    inputSchema: z.object({ missing_person_id: z.string().uuid() }),
    execute: async ({ missing_person_id }) => {
      try {
        const data = (await supaRpc("suggest_patient_matches", {
          p_missing_id: missing_person_id,
        })) as Array<Record<string, unknown>>;

        const mpRows = (await supaGet(
          `missing_persons?select=id,name,age,id_number,state,municipality,last_seen_location&id=eq.${missing_person_id}&limit=1`,
        )) as Array<Record<string, unknown>>;
        const mp = mpRows[0] ?? {};

        const ids = data.map((m) => String(m.patient_id ?? m.id)).filter(Boolean);
        const detailMap: Record<string, Record<string, unknown>> = {};
        if (ids.length) {
          const quoted = ids.map((i) => `"${i}"`).join(",");
          const pRows = (await supaGet(
            `patients?select=id,name,age,id_number,sector,center_name,status&id=in.(${quoted})`,
          )) as Array<Record<string, unknown>>;
          for (const p of pRows) detailMap[String(p.id)] = p;
        }

        const mpTokens = normalizeNameTokens(String(mp.name ?? ""));
        const matches = data.slice(0, 10).map((m) => {
          const pid = String(m.patient_id ?? m.id);
          const p = detailMap[pid] ?? {};
          const score = Number(m.score ?? 0);
          const reasons: string[] = [];

          if (
            mp.id_number &&
            p.id_number &&
            String(mp.id_number).trim() === String(p.id_number).trim()
          ) {
            reasons.push("Cédula idéntica");
          }
          const pTokens = normalizeNameTokens(String(p.name ?? m.patient_name ?? ""));
          const shared = mpTokens.filter((t) => pTokens.includes(t));
          if (shared.length >= 2) reasons.push(`Coinciden ${shared.length} nombres/apellidos`);
          else if (shared.length === 1) reasons.push("Coincide 1 nombre/apellido");

          if (mp.age != null && p.age != null) {
            const diff = Math.abs(Number(mp.age) - Number(p.age));
            if (diff === 0) reasons.push(`Misma edad (${p.age})`);
            else if (diff <= 2) reasons.push(`Edad similar (±${diff} años)`);
          }

          if (mp.last_seen_location && p.sector) {
            const a = String(mp.last_seen_location).toLowerCase();
            const b = String(p.sector).toLowerCase();
            if (a && b && (a.includes(b) || b.includes(a))) {
              reasons.push(`Misma zona (${p.sector})`);
            }
          }

          const hasIdMatch = reasons.some((r) => r.startsWith("Cédula"));
          const confidence =
            hasIdMatch ? "alta" : score >= 0.75 ? "alta" : score >= 0.55 ? "media" : "baja";

          return {
            patient_id: pid,
            patient_name: p.name ?? m.patient_name ?? null,
            patient_age: p.age ?? m.patient_age ?? null,
            patient_id_number: p.id_number ?? null,
            center_name: p.center_name ?? m.center_name ?? null,
            status: p.status ?? m.status ?? null,
            score,
            confidence,
            reasons,
          };
        });

        return {
          missing_person_id,
          missing_person_name: mp.name ?? null,
          count: matches.length,
          matches,
        };
      } catch (e) {
        return { error: String(e instanceof Error ? e.message : e), count: 0, matches: [] };
      }
    },
  }),

  register_missing_person: tool({
    description:
      "Registra una nueva persona desaparecida. SOLO ejecutar después de confirmar con el usuario los datos. Pasa confirm=true únicamente cuando el usuario ya confirmó.",
    inputSchema: z.object({
      confirm: z.boolean().describe("true solo cuando el usuario ya confirmó explícitamente"),
      full_name: z.string().min(2),
      id_number: z.string().optional(),
      age: z.number().int().min(0).max(120).optional(),
      state: z.string().optional(),
      municipality: z.string().optional(),
      parish: z.string().optional(),
      last_seen_location: z.string().optional(),
      description: z.string().optional(),
      contact_name: z.string().optional(),
      contact_phone: z.string().optional(),
    }),
    execute: async (input) => {
      if (!input.confirm) {
        return {
          status: "pending_confirmation",
          message: "Muestra los datos al usuario y pide confirmación antes de registrar.",
          preview: { ...input, confirm: undefined },
        };
      }
      const payload = {
        name: input.full_name.trim(),
        id_number: input.id_number?.trim() || null,
        age: input.age ?? null,
        state: input.state ?? null,
        municipality: input.municipality ?? null,
        parish: input.parish ?? null,
        last_seen_location: input.last_seen_location ?? null,
        description: input.description ?? null,
        contact_name: input.contact_name ?? null,
        contact_phone: input.contact_phone ?? null,
        status: "missing",
        source_label: "tsunami_agent",
      };
      const rows = (await supaPost("missing_persons", payload)) as Array<Record<string, unknown>>;
      const created = rows[0];
      return {
        status: "ok",
        id: created?.id,
        url: `${SITE}/desaparecidos?person=${created?.id}`,
      };
    },
  }),

  list_needs: tool({
    description:
      "Lista necesidades activas publicadas por la comunidad. Útil para guiar a quien quiere ofrecer ayuda.",
    inputSchema: z.object({
      category: z.string().optional(),
      state: z.string().optional(),
      urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async ({ category, state, urgency, limit = 10 }) => {
      let path = `needs?select=id,title,category,urgency,center_name,center_address,quantity,description,created_at&status=eq.open&order=created_at.desc&limit=${limit}`;
      if (category) path += `&category=eq.${encodeURIComponent(category)}`;
      if (state) path += `&center_address=ilike.${encodeURIComponent(`*${esc(state)}*`)}`;
      if (urgency) path += `&urgency=eq.${urgency}`;
      const rows = (await supaGet(path)) as Array<Record<string, unknown>>;
      return {
        count: rows.length,
        results: rows.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          urgency: r.urgency,
          center_name: r.center_name,
          center_address: r.center_address,
          quantity: r.quantity,
          url: `${SITE}/necesidades?need=${r.id}`,
        })),
      };
    },
  }),

  get_need: tool({
    description: "Detalle de una necesidad por id, con deep link para ofrecer ayuda.",
    inputSchema: z.object({ id: z.string().uuid() }),
    execute: async ({ id }) => {
      const rows = (await supaGet(
        `needs?select=*&id=eq.${id}&limit=1`,
      )) as Array<Record<string, unknown>>;
      if (rows.length === 0) return { error: "No encontrado" };
      const n = rows[0];
      return {
        id: n.id,
        title: n.title,
        category: n.category,
        urgency: n.urgency,
        description: n.description,
        quantity: n.quantity,
        center_name: n.center_name,
        center_address: n.center_address,
        contact_name: n.contact_name,
        contact_phone: n.contact_phone,
        offer_url: `${SITE}/ofertas?need=${n.id}`,
        view_url: `${SITE}/necesidades?need=${n.id}`,
      };
    },
  }),

  guide_offer_help: tool({
    description:
      "Devuelve una guía breve en 4 pasos para que el usuario ofrezca ayuda dentro del chat. NO incluye enlaces externos: el propio Tsunami hará el registro con register_offer.",
    inputSchema: z.object({
      need_id: z.string().uuid().optional(),
      category: z.string().optional(),
    }),
    execute: async ({ need_id, category }) => {
      return {
        steps: [
          "Cuéntame qué tipo de ayuda puedes ofrecer (categoría: alimentos, agua, medicinas, transporte, alojamiento, voluntariado, otros).",
          "Dime cantidad o descripción breve de lo que ofreces.",
          "Indícame ciudad, estado y dirección desde donde puedes entregar.",
          "Déjame tu nombre y teléfono para coordinar.",
        ],
        note: "Cuando tengas los datos, Tsunami mismo registra la oferta aquí en el chat, sin salir a otra pantalla.",
        need_id: need_id ?? null,
        category: category ?? null,
      };
    },
  }),

  register_offer: tool({
    description:
      "Registra una oferta de ayuda en la plataforma. SIEMPRE llama primero con confirm=false para mostrar el resumen al usuario y pedir confirmación explícita ('sí, registra'); solo entonces llama con confirm=true. Si viene need_id, la oferta queda vinculada a esa necesidad puntual.",
    inputSchema: z.object({
      confirm: z.boolean().describe("true solo cuando el usuario ya confirmó los datos"),
      need_id: z.string().uuid().optional().describe("Necesidad puntual a la que responde, si aplica"),
      category: z
        .enum(["food", "water", "medical", "shelter", "transport", "clothing", "volunteer", "other"])
        .describe("Categoría de la ayuda ofrecida"),
      title: z.string().min(3).max(120).describe("Título breve de la oferta"),
      description: z.string().optional().describe("Descripción libre"),
      quantity: z.string().optional().describe("Cantidad o unidades (texto libre)"),
      state: z.string().min(2).describe("Estado / entidad federal"),
      city: z.string().min(2).describe("Ciudad o municipio"),
      address: z.string().min(3).describe("Dirección específica de origen o entrega"),
      contact_name: z.string().min(2).describe("Nombre de contacto"),
      contact_phone: z.string().min(6).describe("Teléfono de contacto"),
    }),
    execute: async (input) => {
      if (!input.confirm) {
        return {
          status: "pending_confirmation",
          message: "Muestra este resumen al usuario y pide 'sí, registra' antes de guardar.",
          preview: { ...input, confirm: undefined },
        };
      }
      const location_desc = [input.address, input.city, input.state].filter(Boolean).join(", ");
      const payload = {
        need_id: input.need_id ?? null,
        category: input.category,
        title: input.title.trim(),
        description: input.description ?? null,
        quantity: input.quantity ?? null,
        state: input.state,
        city: input.city,
        address: input.address,
        location_desc,
        contact_name: input.contact_name,
        contact_phone: input.contact_phone,
        status: "open",
      };
      try {
        const rows = (await supaPost("offers", payload)) as Array<Record<string, unknown>>;
        const created = rows[0];
        return {
          status: "ok",
          id: created?.id,
          message:
            "Oferta registrada. Quien publicó la necesidad (o el equipo) podrá contactarte pronto.",
        };
      } catch (e) {
        return { status: "error", error: String(e instanceof Error ? e.message : e) };
      }
    },
  }),
};
