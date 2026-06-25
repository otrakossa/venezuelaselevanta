import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMissing } from "@/hooks/useReports";
import { toast } from "sonner";
import { Search, UserPlus, UserCheck } from "lucide-react";

export const Route = createFileRoute("/desaparecidos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Personas desaparecidas — Venezuela Se Levanta" },
      { name: "description", content: "Reporta y busca personas desaparecidas tras el terremoto en Venezuela." },
    ],
  }),
  component: MissingPage,
});

function MissingPage() {
  const { missing } = useMissing();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "desaparecido" | "encontrado">("desaparecido");
  const [showForm, setShowForm] = useState(false);

  const list = missing
    .filter((m) => filter === "all" || m.status === filter)
    .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || (m.last_seen_location ?? "").toLowerCase().includes(q.toLowerCase()));

  const markFound = async (id: string) => {
    const { error } = await supabase.from("missing_persons").update({ status: "encontrado" }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Marcado como encontrado ❤️");
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Personas desaparecidas</h1>
          <p className="text-sm text-muted-foreground">{missing.filter((m) => m.status === "desaparecido").length} sin encontrar</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold"
        >
          <UserPlus className="h-4 w-4" /> Reportar desaparecido
        </button>
      </div>

      {showForm && <MissingForm onDone={() => setShowForm(false)} />}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o ubicación..."
            className="w-full pl-8 pr-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-1">
          {(["desaparecido", "encontrado", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded font-medium ${filter === f ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
            >
              {f === "all" ? "Todos" : f === "desaparecido" ? "Buscando" : "Encontrados"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((m) => (
          <div key={m.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{m.name}</h3>
                {m.age && <p className="text-xs text-muted-foreground">{m.age} años</p>}
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded font-bold ${
                  m.status === "encontrado" ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"
                }`}
              >
                {m.status === "encontrado" ? "ENCONTRADO" : "BUSCANDO"}
              </span>
            </div>
            {m.physical_description && <p className="text-xs">{m.physical_description}</p>}
            {m.last_seen_location && <p className="text-xs text-muted-foreground">📍 {m.last_seen_location}</p>}
            {m.contact_info && <p className="text-xs"><span className="font-semibold">Contacto:</span> {m.contact_info}</p>}
            {m.status === "desaparecido" && (
              <button
                onClick={() => markFound(m.id)}
                className="w-full flex items-center justify-center gap-1.5 mt-2 bg-emerald-500 text-white text-xs font-semibold py-2 rounded hover:opacity-90"
              >
                <UserCheck className="h-3.5 w-3.5" /> Marcar como encontrada
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            No hay registros que coincidan.
          </div>
        )}
      </div>
    </div>
  );
}

function MissingForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", age: "", physical_description: "", last_seen_location: "", contact_info: "" });
  const [busy, setBusy] = useState(false);
  const field = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Nombre requerido");
    setBusy(true);
    const { error } = await supabase.from("missing_persons").insert({
      name: f.name.trim(),
      age: f.age ? Number(f.age) : null,
      physical_description: f.physical_description.trim() || null,
      last_seen_location: f.last_seen_location.trim() || null,
      contact_info: f.contact_info.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reporte enviado");
    onDone();
  };
  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-lg p-4 mb-4 grid sm:grid-cols-2 gap-3">
      <input className={field} placeholder="Nombre completo *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={100} />
      <input type="number" className={field} placeholder="Edad" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} />
      <input className={`${field} sm:col-span-2`} placeholder="Descripción física (ropa, altura, señas)" value={f.physical_description} onChange={(e) => setF({ ...f, physical_description: e.target.value })} maxLength={500} />
      <input className={field} placeholder="Última ubicación conocida" value={f.last_seen_location} onChange={(e) => setF({ ...f, last_seen_location: e.target.value })} maxLength={200} />
      <input className={field} placeholder="Contacto de familiar" value={f.contact_info} onChange={(e) => setF({ ...f, contact_info: e.target.value })} maxLength={200} />
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm rounded-md border border-border">Cancelar</button>
        <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50">
          {busy ? "Enviando..." : "Publicar reporte"}
        </button>
      </div>
    </form>
  );
}
