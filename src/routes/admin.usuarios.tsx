import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useReports";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";
import { ShieldCheck, UserPlus, Trash2, Shield, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/usuarios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Usuarios — Admin" }] }),
  component: UsersPage,
});

type Row = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  roles: string[];
};

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No session");
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return body;
}

function UsersPage() {
  const { isAuthenticated, userId } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(userId);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "admin" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = (await authedFetch("/api/public/admin/users")) as { users: Row[] };
      setRows(body.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const toggleRole = async (row: Row, role: "admin" | "moderator") => {
    const has = row.roles.includes(role);
    setBusyId(row.id);
    try {
      await authedFetch("/api/public/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: has ? "revoke" : "grant", user_id: row.id, role }),
      });
      toast.success(has ? `Rol ${role} removido` : `Rol ${role} asignado`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`¿Eliminar usuario ${row.email}? Esta acción no se puede deshacer.`)) return;
    setBusyId(row.id);
    try {
      await authedFetch("/api/public/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "delete", user_id: row.id }),
      });
      toast.success("Usuario eliminado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await authedFetch("/api/public/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "create", ...form }),
      });
      toast.success(`Usuario ${form.email} creado`);
      setForm({ email: "", password: "", role: "admin" });
      setShowCreate(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-vzla-blue mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
        <Link to="/auth" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-semibold text-sm">
          Iniciar sesión
        </Link>
      </div>
    );
  }
  if (roleLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Verificando permisos...</div>;
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-[color:var(--sunrise)] mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Sin permisos</h1>
        <p className="text-sm text-muted-foreground">Necesitas rol admin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
      <AdminNav />
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Usuarios y roles</h1>
          <p className="text-[11px] text-muted-foreground">Gestiona quién puede acceder al panel admin.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-border rounded-md hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Recargar
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-[color:var(--sunrise)] text-white rounded-md font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5" /> Nuevo usuario
          </button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={create}
          className="mb-4 p-4 border border-border rounded-lg bg-muted/30 grid sm:grid-cols-4 gap-2"
        >
          <input
            required
            type="email"
            placeholder="email@ejemplo.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 text-sm border border-input rounded-md bg-background sm:col-span-2"
          />
          <input
            required
            type="password"
            placeholder="Contraseña (≥8)"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="px-3 py-2 text-sm border border-input rounded-md bg-background"
          />
          <div className="flex gap-2">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-2 py-2 text-sm border border-input rounded-md bg-background flex-1"
            >
              <option value="admin">admin</option>
              <option value="moderator">moderator</option>
              <option value="user">user</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md font-semibold disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
            </button>
          </div>
        </form>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Roles</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Último acceso</th>
              <th className="text-right px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted-foreground">
                  Sin usuarios
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isSelf = r.id === userId;
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.email ?? <em>sin email</em>}</div>
                      {isSelf && <div className="text-[10px] text-[color:var(--sunrise)] font-semibold">tú</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {r.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {r.roles.map((role) => (
                          <span
                            key={role}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              role === "admin"
                                ? "bg-[color:var(--sunrise)]/20 text-[color:var(--sunrise)]"
                                : role === "moderator"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-muted text-foreground"
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                      {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("es-VE") : "Nunca"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button
                          disabled={busy || (isSelf && r.roles.includes("admin"))}
                          onClick={() => toggleRole(r, "admin")}
                          title={r.roles.includes("admin") ? "Quitar admin" : "Hacer admin"}
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border disabled:opacity-40 ${
                            r.roles.includes("admin")
                              ? "border-[color:var(--sunrise)] text-[color:var(--sunrise)]"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <Shield className="h-3 w-3" /> {r.roles.includes("admin") ? "Quitar admin" : "Admin"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => toggleRole(r, "moderator")}
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border disabled:opacity-40 ${
                            r.roles.includes("moderator")
                              ? "border-sky-500 text-sky-600"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {r.roles.includes("moderator") ? "Quitar mod" : "Mod"}
                        </button>
                        <button
                          disabled={busy || isSelf}
                          onClick={() => remove(r)}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Los usuarios nuevos se crean con email confirmado y pueden iniciar sesión inmediatamente.
      </p>
    </div>
  );
}
