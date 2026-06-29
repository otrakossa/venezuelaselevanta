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
      "Busca coincidencias entre una persona desaparecida y pacientes atendidos en centros médicos (por cédula, nombre, etc.). Útil cuando alguien busca a un familiar.",
    inputSchema: z.object({ missing_person_id: z.string().uuid() }),
    execute: async ({ missing_person_id }) => {
      try {
        const data = (await supaRpc("suggest_patient_matches", {
          p_missing_id: missing_person_id,
        })) as Array<Record<string, unknown>>;
        return {
          count: data.length,
          matches: data.slice(0, 10).map((m) => ({
            patient_id: m.patient_id ?? m.id,
            patient_name: m.patient_name ?? m.name,
            center_name: m.center_name,
            score: m.score ?? m.match_score,
            reason: m.reason ?? m.match_reason,
          })),
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
      "Genera una guía paso a paso para que una persona ofrezca ayuda. Si hay una necesidad específica (need_id), incluye el deep-link al wizard prellenado.",
    inputSchema: z.object({
      need_id: z.string().uuid().optional(),
      category: z.string().optional(),
    }),
    execute: async ({ need_id, category }) => {
      return {
        steps: [
          "Identifica qué tipo de ayuda puedes ofrecer (insumos, transporte, alojamiento, voluntariado).",
          "Indica ciudad, estado y dirección donde puedes entregar o desde dónde operas.",
          "Deja un contacto válido (nombre y teléfono) para coordinar.",
          "Confirma horarios disponibles para la entrega o el servicio.",
        ],
        offer_url: need_id
          ? `${SITE}/ofertas?need=${need_id}`
          : `${SITE}/ofertas${category ? `?category=${encodeURIComponent(category)}` : ""}`,
      };
    },
  }),
};
