import { useEffect, useState } from "react";
import { sbx } from "./_client";
import { Loader2, Search, ExternalLink, CheckCircle2, MapPin, Image as ImageIcon, Trash2, GitMerge, Pencil } from "lucide-react";
import { toast } from "sonner";


type Kind = "missing" | "patient";
type Row = {
  id: string;
  name: string;
  age: number | null;
  location: string | null;
  status: string | null;
  source_label: string | null;
  source_url: string | null;
  photo_url: string | null;
  matched: boolean;
  has_coords: boolean;
  created_at: string;
};

const PAGE = 50;
const fmt = (n: number) => n.toLocaleString("es-VE");

export function RecordsExplorer() {
  const [kind, setKind] = useState<Kind>("missing");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [matched, setMatched] = useState<"" | "yes" | "no">("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasCoords, setHasCoords] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); }, [kind, debounced, source, status, matched, hasPhoto, hasCoords]);

  // Load distinct sources
  useEffect(() => {
    (async () => {
      const tbl = kind === "missing" ? "missing_persons" : "patients";
      const { data } = await sbx.from(tbl).select("source_label").not("source_label", "is", null).limit(2000);
      const set = new Set<string>();
      (data ?? []).forEach((r: { source_label: string | null }) => r.source_label && set.add(r.source_label));
      setSources(Array.from(set).sort());
    })();
  }, [kind]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const tbl = kind === "missing" ? "missing_persons" : "patients";
      const cols =
        kind === "missing"
          ? "id,name,age,last_seen_location,status,source_label,source_url,photo_url,matched_patient_id,last_seen_lat,last_seen_lng,created_at"
          : "id,name,age,center_name,status,source_label,source_url,photo_url,matched_missing_id,created_at";
      let q = sbx.from(tbl).select(cols, { count: "exact" });
      if (debounced) q = q.ilike("name", `%${debounced}%`);
      if (source) q = q.eq("source_label", source);
      if (status) q = q.eq("status", status);
      if (matched === "yes") q = q.not(kind === "missing" ? "matched_patient_id" : "matched_missing_id", "is", null);
      if (matched === "no")  q = q.is(kind === "missing" ? "matched_patient_id" : "matched_missing_id", null);
      if (hasPhoto) q = q.not("photo_url", "is", null);
      if (kind === "missing" && hasCoords) {
        q = q.not("last_seen_lat", "is", null).not("last_seen_lng", "is", null);
      }
      q = q.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);

      const { data, count: c, error } = await q;
      if (cancel) return;
      if (error) { toast.error(error.message); setLoading(false); return; }
      const mapped: Row[] = (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name as string) ?? "",
        age: (r.age as number | null) ?? null,
        location: (kind === "missing" ? r.last_seen_location : r.center_name) as string | null,
        status: (r.status as string | null) ?? null,
        source_label: (r.source_label as string | null) ?? null,
        source_url: (r.source_url as string | null) ?? null,
        photo_url: (r.photo_url as string | null) ?? null,
        matched: kind === "missing" ? r.matched_patient_id != null : r.matched_missing_id != null,
        has_coords: kind === "missing" ? r.last_seen_lat != null && r.last_seen_lng != null : false,
        created_at: r.created_at as string,
      }));
      setRows(mapped);
      setCount(c ?? 0);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [kind, debounced, source, status, matched, hasPhoto, hasCoords, page]);

  const markFound = async (id: string) => {
    const outcome = prompt(
      "¿Outcome? Escribe una opción exacta o deja en blanco:\n- at_health_center\n- with_family\n- relocated\n- other",
    ) ?? "";
    const note = prompt("Nota opcional:") ?? null;
    const { error } = await sbx.rpc("mark_missing_found", {
      p_id: id,
      p_outcome: outcome.trim() || null,
      p_note: note,
    });
    if (error) toast.error(error.message);
    else { toast.success("Marcada como encontrada"); setRows((rs) => rs.map((r) => r.id === id ? { ...r, status: "found" } : r)); }
  };

  const markDeceased = async (id: string) => {
    if (!confirm("¿Marcar como fallecida/o? Esta acción es sensible.")) return;
    const note = prompt("Nota opcional:") ?? null;
    const { error } = await sbx.rpc("mark_missing_deceased", { p_id: id, p_note: note });
    if (error) toast.error(error.message);
    else { toast.success("Marcado como fallecido"); setRows((rs) => rs.map((r) => r.id === id ? { ...r, status: "deceased" } : r)); }
  };

  const setPatientStatus = async (id: string) => {
    const next = prompt(
      "Nuevo estado del paciente. Opciones comunes:\n- stable\n- admitted\n- discharged\n- reunited\n- deceased",
    )?.trim();
    if (!next) return;
    const note = prompt("Nota opcional (se agrega al historial):") ?? null;
    const { error } = await sbx.rpc("set_patient_status", { p_id: id, p_status: next, p_note: note });
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, status: next } : r));
  };

  const deletePatient = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar definitivamente al paciente "${name}"?\nEsta acción no se puede deshacer.`)) return;
    const { error } = await sbx.rpc("delete_patient", { p_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Paciente eliminado");
    setRows((rs) => rs.filter((r) => r.id !== id));
    setCount((c) => Math.max(0, c - 1));
  };

  const mergePatient = async (duplicateId: string, name: string) => {
    const canonical = prompt(
      `Fusionar "${name}" como DUPLICADO en otro paciente.\n\nPega el ID (uuid) del paciente CANÓNICO (el que se conserva):`,
    )?.trim();
    if (!canonical) return;
    if (canonical === duplicateId) { toast.error("El ID canónico debe ser distinto"); return; }
    if (!/^[0-9a-f-]{36}$/i.test(canonical)) { toast.error("UUID inválido"); return; }
    if (!confirm(`Se eliminará "${name}" y sus datos se consolidarán en ${canonical.slice(0,8)}…\n¿Continuar?`)) return;
    const { error } = await sbx.rpc("merge_patients", { p_canonical_id: canonical, p_duplicate_id: duplicateId });
    if (error) { toast.error(error.message); return; }
    toast.success("Pacientes fusionados");
    setRows((rs) => rs.filter((r) => r.id !== duplicateId));
    setCount((c) => Math.max(0, c - 1));
  };


  const select = "px-2 py-1.5 rounded-md border border-input bg-background text-xs";
  const totalPages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          {(["missing","patient"] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`px-3 py-1.5 font-semibold ${kind===k ? "bg-[color:var(--sunrise)] text-white" : "bg-background hover:bg-muted"}`}>
              {k === "missing" ? "Desaparecidos" : "Atendidos"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre..."
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-input bg-background text-xs" />
        </div>
        <select className={select} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Todas las fuentes</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {kind === "missing"
            ? <><option value="missing">Buscando</option><option value="found">Encontrada</option><option value="deceased">Fallecida</option></>
            : <><option value="admitted">Ingresado</option><option value="discharged">Egresado</option><option value="reunited">Reunido</option><option value="deceased">Fallecido</option></>}
        </select>
        <select className={select} value={matched} onChange={(e) => setMatched(e.target.value as "" | "yes" | "no")}>
          <option value="">Match: todos</option>
          <option value="yes">Con match</option>
          <option value="no">Sin match</option>
        </select>
        <label className="inline-flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={hasPhoto} onChange={(e) => setHasPhoto(e.target.checked)} /> con foto
        </label>
        {kind === "missing" && (
          <label className="inline-flex items-center gap-1 text-[11px]">
            <input type="checkbox" checked={hasCoords} onChange={(e) => setHasCoords(e.target.checked)} /> con coords
          </label>
        )}
        <div className="ml-auto text-[11px] text-muted-foreground">
          {loading ? <Loader2 className="h-3 w-3 inline animate-spin" /> : <>{fmt(count)} resultados</>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-2 py-2 w-10"></th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Edad</th>
              <th className="px-3 py-2">Ubicación</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2">Señales</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-2 py-1.5">
                  {r.photo_url
                    ? <img src={r.photo_url} alt="" className="h-8 w-8 rounded object-cover" loading="lazy" />
                    : <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-3 w-3 text-muted-foreground" /></div>}
                </td>
                <td className="px-3 py-2 font-semibold max-w-[200px] truncate">{r.name}</td>
                <td className="px-3 py-2">{r.age ?? "—"}</td>
                <td className="px-3 py-2 max-w-[220px] truncate text-muted-foreground">{r.location ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-semibold">{r.status ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.source_label ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {r.matched && <span className="text-[9px] bg-emerald-500 text-white px-1 rounded">MATCH</span>}
                    {kind === "missing" && r.has_coords && <MapPin className="h-3 w-3 text-blue-500" />}
                    {r.photo_url && <ImageIcon className="h-3 w-3 text-amber-500" />}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                         className="p-1.5 rounded hover:bg-muted" title="Ver en origen">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {kind === "missing" && r.status !== "found" && (
                      <button onClick={() => markFound(r.id)} className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600" title="Marcar como encontrada">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {kind === "missing" && r.status !== "deceased" && (
                      <button onClick={() => markDeceased(r.id)} className="p-1.5 rounded hover:bg-neutral-200 text-neutral-700" title="Marcar como fallecida/o">
                        🕊️
                      </button>
                    )}
                    {kind === "patient" && (
                      <>
                        <button onClick={() => setPatientStatus(r.id)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600" title="Cambiar estado">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { navigator.clipboard.writeText(r.id); toast.success("ID copiado"); }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground font-mono text-[10px]"
                          title={`Copiar ID (${r.id.slice(0,8)}…)`}
                        >
                          ID
                        </button>
                        <button onClick={() => mergePatient(r.id, r.name)} className="p-1.5 rounded hover:bg-amber-100 text-amber-700" title="Fusionar como duplicado de…">
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deletePatient(r.id, r.name)} className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Eliminar paciente">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs">
        <button disabled={page===0} onClick={() => setPage((p) => Math.max(0, p-1))}
          className="px-3 py-1.5 rounded border border-border disabled:opacity-50">← Anterior</button>
        <span className="text-muted-foreground">Página {page+1} de {totalPages}</span>
        <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p+1)}
          className="px-3 py-1.5 rounded border border-border disabled:opacity-50">Siguiente →</button>
      </div>
    </div>
  );
}
