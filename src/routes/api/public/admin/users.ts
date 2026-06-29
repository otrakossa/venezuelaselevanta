import { createFileRoute } from "@tanstack/react-router";

const PROD_PROJECT_REF = "advebubtfjgxwpjxprok";
const PROD_URL_FALLBACK = `https://${PROD_PROJECT_REF}.supabase.co`;
const PROD_ANON_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDcyMTMsImV4cCI6MjA5ODAyMzIxM30.e4w9nrHsaNRP-enNPS-beZ0Kns7KxvRtVXxRDLECS5U";

const ALLOWED_ROLES = new Set(["admin", "moderator", "user"]);

function cfg() {
  const url = (process.env.NEW_SUPABASE_URL || PROD_URL_FALLBACK).replace(/\/$/, "");
  const anon = process.env.NEW_SUPABASE_PUBLISHABLE_KEY || PROD_ANON_FALLBACK;
  const service = process.env.NEW_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, anon, service };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);
  const { url, anon } = cfg();

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: "Unauthorized" }, 401);
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return json({ error: "Unauthorized" }, 401);

  const roleRes = await fetch(`${url}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
  });
  if (!roleRes.ok) return json({ error: "Forbidden" }, 403);
  const isAdmin = (await roleRes.json()) as boolean;
  if (!isAdmin) return json({ error: "Forbidden: admin required" }, 403);

  return { token, userId: user.id };
}

type AuthUser = { id: string; email?: string; created_at?: string; last_sign_in_at?: string };

async function listAuthUsers(): Promise<AuthUser[]> {
  const { url, service } = cfg();
  if (!service) throw new Error("Missing service role key");
  const out: AuthUser[] = [];
  let page = 1;
  while (page < 20) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    if (!res.ok) throw new Error(`auth admin list ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { users?: AuthUser[] };
    const users = body.users ?? [];
    out.push(...users);
    if (users.length < 200) break;
    page++;
  }
  return out;
}

async function listRoles(): Promise<{ user_id: string; role: string }[]> {
  const { url, service } = cfg();
  const res = await fetch(`${url}/rest/v1/user_roles?select=user_id,role`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  if (!res.ok) throw new Error(`user_roles ${res.status}`);
  return (await res.json()) as { user_id: string; role: string }[];
}

async function grantRole(user_id: string, role: string) {
  const { url, service } = cfg();
  const res = await fetch(`${url}/rest/v1/user_roles?on_conflict=user_id,role`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({ user_id, role }),
  });
  if (!res.ok) throw new Error(`grant ${res.status}: ${await res.text()}`);
}

async function revokeRole(user_id: string, role: string) {
  const { url, service } = cfg();
  const res = await fetch(
    `${url}/rest/v1/user_roles?user_id=eq.${user_id}&role=eq.${role}`,
    { method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  if (!res.ok) throw new Error(`revoke ${res.status}: ${await res.text()}`);
}

async function createUser(email: string, password: string) {
  const { url, service } = cfg();
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`create user ${res.status}: ${await res.text()}`);
  return (await res.json()) as AuthUser;
}

async function deleteUser(user_id: string) {
  const { url, service } = cfg();
  const res = await fetch(`${url}/auth/v1/admin/users/${user_id}`, {
    method: "DELETE",
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  if (!res.ok) throw new Error(`delete user ${res.status}: ${await res.text()}`);
}

export const Route = createFileRoute("/api/public/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = await requireAdmin(request);
        if (guard instanceof Response) return guard;
        try {
          const [users, roles] = await Promise.all([listAuthUsers(), listRoles()]);
          const byUser = new Map<string, string[]>();
          for (const r of roles) {
            if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
            byUser.get(r.user_id)!.push(r.role);
          }
          const merged = users
            .map((u) => ({
              id: u.id,
              email: u.email ?? null,
              created_at: u.created_at ?? null,
              last_sign_in_at: u.last_sign_in_at ?? null,
              roles: byUser.get(u.id) ?? [],
            }))
            .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
          return json({ users: merged });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 500);
        }
      },
      POST: async ({ request }) => {
        const guard = await requireAdmin(request);
        if (guard instanceof Response) return guard;
        let body: {
          action?: "grant" | "revoke" | "create" | "delete";
          user_id?: string;
          role?: string;
          email?: string;
          password?: string;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        try {
          const action = body.action;
          if (action === "grant" || action === "revoke") {
            if (!body.user_id || !body.role) return json({ error: "user_id and role required" }, 400);
            if (!ALLOWED_ROLES.has(body.role)) return json({ error: "invalid role" }, 400);
            if (action === "grant") await grantRole(body.user_id, body.role);
            else {
              if (body.user_id === guard.userId && body.role === "admin") {
                return json({ error: "No puedes quitarte tu propio rol admin" }, 400);
              }
              await revokeRole(body.user_id, body.role);
            }
            return json({ ok: true });
          }
          if (action === "create") {
            if (!body.email || !body.password) return json({ error: "email and password required" }, 400);
            if (body.password.length < 8) return json({ error: "password must be ≥ 8 chars" }, 400);
            const u = await createUser(body.email.trim().toLowerCase(), body.password);
            if (body.role && ALLOWED_ROLES.has(body.role) && body.role !== "user") {
              await grantRole(u.id, body.role);
            }
            return json({ ok: true, user: u });
          }
          if (action === "delete") {
            if (!body.user_id) return json({ error: "user_id required" }, 400);
            if (body.user_id === guard.userId) return json({ error: "No puedes eliminarte a ti mismo" }, 400);
            await deleteUser(body.user_id);
            return json({ ok: true });
          }
          return json({ error: "Unknown action" }, 400);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : String(e) }, 500);
        }
      },
    },
  },
});
