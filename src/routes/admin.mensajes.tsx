import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useReports";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminOnlyNotice } from "@/components/admin/AdminOnlyNotice";
import { HeartbeatLoader } from "@/components/HeartbeatLoader";
import {
  ShieldCheck,
  Mail,
  RefreshCw,
  Search,
  CheckCircle2,
  Circle,
  Reply,
  Trash2,
  Inbox,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/mensajes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mensajes de contacto — Admin" }] }),
  component: MessagesPage,
});

type Row = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  created_at: string;
  handled: boolean;
};

type Tab = "pending" | "handled" | "all";
type DateRange = "24h" | "7d" | "30d" | "all";

const DATE_RANGE_MS: Record<DateRange, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

function MessagesPage() {
  const { isAuthenticated, userId } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(userId);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [range, setRange] = useState<DateRange>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);


  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "pending" && r.handled) return false;
      if (tab === "handled" && !r.handled) return false;
      if (!needle) return true;
      const hay = `${r.name} ${r.email} ${r.subject ?? ""} ${r.message}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, tab, q]);

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => !r.handled).length,
      handled: rows.filter((r) => r.handled).length,
      all: rows.length,
    }),
    [rows],
  );

  const setHandled = async (row: Row, next: boolean) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from("contact_messages")
      .update({ handled: next })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, handled: next } : r)));
      toast.success(next ? "Marcado como respondido" : "Reabierto");
    }
    setBusyId(null);
  };

  const del = async (row: Row) => {
    if (!confirm(`¿Eliminar el mensaje de ${row.name}? Esta acción no se puede deshacer.`)) return;
    setBusyId(row.id);
    const { error } = await supabase.from("contact_messages").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      if (openId === row.id) setOpenId(null);
      toast.success("Mensaje eliminado");
    }
    setBusyId(null);
  };

  const replyHref = (row: Row) => {
    const subject = encodeURIComponent(
      row.subject ? `Re: ${row.subject}` : "Re: Tu mensaje en Venezuela Se Levanta",
    );
    const body = encodeURIComponent(
      `Hola ${row.name},\n\nGracias por escribirnos.\n\n---\nTu mensaje original:\n${row.message}\n`,
    );
    return `mailto:${row.email}?subject=${subject}&body=${body}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-vzla-blue mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
        <Link
          to="/auth"
          className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-semibold text-sm"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }
  if (roleLoading)
    return <div className="p-10 text-center text-sm text-muted-foreground">Verificando permisos...</div>;
  if (!isAdmin) return <AdminOnlyNotice section="Mensajes de contacto" />;

  const open = filtered.find((r) => r.id === openId) ?? null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <AdminNav />
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-[color:var(--sunrise)]" /> Mensajes de contacto
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Bandeja de entrada del formulario público. Responde por correo y marca como atendido.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-border rounded-md hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recargar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-border">
        {(
          [
            { k: "pending", label: "Pendientes", icon: <Inbox className="h-3.5 w-3.5" /> },
            { k: "handled", label: "Respondidos", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
            { k: "all", label: "Todos", icon: <Mail className="h-3.5 w-3.5" /> },
          ] as { k: Tab; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              tab === t.k
                ? "border-[color:var(--sunrise)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{counts[t.k]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-3">
        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email, asunto o mensaje..."
          className="w-full pl-7 pr-2 py-1.5 rounded-md border border-input bg-background text-xs"
        />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* List */}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {loading ? (
            <div className="py-16 text-center">
              <HeartbeatLoader className="size-8 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay mensajes en esta vista.
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
              {filtered.map((r) => {
                const active = openId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setOpenId(r.id)}
                      className={`w-full text-left px-3 py-2.5 flex gap-2 items-start hover:bg-muted/40 transition ${
                        active ? "bg-[color:var(--sunrise)]/10" : ""
                      }`}
                    >
                      <div className="mt-0.5">
                        {r.handled ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-[color:var(--sunrise)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm truncate ${r.handled ? "font-normal" : "font-semibold"}`}>
                            {r.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-auto">
                            {format(new Date(r.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>
                        {r.subject && (
                          <div className="text-xs font-medium truncate mt-0.5">{r.subject}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {r.message}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="border border-border rounded-lg bg-card p-4 min-h-[300px]">
          {!open ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground py-16">
              <Mail className="h-10 w-10 mb-2 text-muted-foreground/50" />
              Selecciona un mensaje para ver el detalle.
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="text-lg font-bold truncate">
                    {open.subject || "Sin asunto"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    De <b>{open.name}</b> ·{" "}
                    <a href={`mailto:${open.email}`} className="text-[color:var(--sunrise)] hover:underline">
                      {open.email}
                    </a>{" "}
                    · {format(new Date(open.created_at), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
                {open.handled ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                    Respondido
                  </span>
                ) : (
                  <span className="text-[10px] bg-[color:var(--sunrise)]/20 text-[color:var(--sunrise)] px-2 py-0.5 rounded font-semibold">
                    Pendiente
                  </span>
                )}
              </div>

              <div className="text-sm whitespace-pre-wrap bg-muted/30 border border-border rounded-md p-3 mb-4 flex-1">
                {open.message}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={replyHref(open)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[color:var(--sunrise)] text-white rounded-md font-semibold text-sm hover:opacity-90"
                >
                  <Reply className="h-4 w-4" /> Responder por correo
                </a>
                <button
                  disabled={busyId === open.id}
                  onClick={() => setHandled(open, !open.handled)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-50"
                >
                  {open.handled ? (
                    <>
                      <Circle className="h-4 w-4" /> Marcar pendiente
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Marcar respondido
                    </>
                  )}
                </button>
                <button
                  disabled={busyId === open.id}
                  onClick={() => del(open)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-md text-sm hover:bg-red-50 disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Al pulsar “Responder” se abrirá tu cliente de correo con la respuesta preformateada.
                Marca el mensaje como respondido cuando lo hayas enviado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
