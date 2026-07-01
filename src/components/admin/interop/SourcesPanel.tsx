import { useEffect, useState } from "react";
import { sbx } from "./_client";
import { Loader2, RefreshCw, ImageIcon, MapPin, CheckCircle2, Link2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ScraperRunsPanel } from "./ScraperRunsPanel";

type Row = {
  kind: "missing" | "patient";
  source_label: string;
  total: number;
  with_photo: number;
  with_coords: number;
  matched: number;
  found: number;
  last_created: string | null;
};

const fmt = (n: number) => n.toLocaleString("es-VE");
const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);

export function SourcesPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    const { data, error } = await sbx.rpc<Row[]>("interop_source_overview");
    if (error) setErr(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const missing = (rows ?? []).filter((r) => r.kind === "missing");
  const patient = (rows ?? []).filter((r) => r.kind === "patient");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          KPIs en vivo desde la base de producción. Cada fila es un origen de datos (scraper, bot, ingesta manual).
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refrescar
        </button>
      </div>

      {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">{err}</div>}

      <Section title="Personas desaparecidas por fuente" rows={missing} kind="missing" />
      <Section title="Pacientes / Atendidos por fuente" rows={patient} kind="patient" />
      <ScraperRunsPanel />
    </div>
  );
}

function Section({ title, rows, kind }: { title: string; rows: Row[]; kind: "missing" | "patient" }) {
  const totals = rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      with_photo: a.with_photo + r.with_photo,
      with_coords: a.with_coords + r.with_coords,
      matched: a.matched + r.matched,
      found: a.found + r.found,
    }),
    { total: 0, with_photo: 0, with_coords: 0, matched: 0, found: 0 },
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/40">
        <h2 className="text-sm font-bold">{title}</h2>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Total: <b>{fmt(totals.total)}</b> · con foto {pct(totals.with_photo, totals.total)} ·
          {kind === "missing" && <> con coords {pct(totals.with_coords, totals.total)} · </>}
          vinculados {pct(totals.matched, totals.total)} ·
          {kind === "missing" ? " encontrados " : " egresados "}{pct(totals.found, totals.total)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-left">
            <tr>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right"><ImageIcon className="h-3 w-3 inline" /> Foto</th>
              {kind === "missing" && <th className="px-3 py-2 text-right"><MapPin className="h-3 w-3 inline" /> Coords</th>}
              <th className="px-3 py-2 text-right"><Link2 className="h-3 w-3 inline" /> Vinculados</th>
              <th className="px-3 py-2 text-right"><CheckCircle2 className="h-3 w-3 inline" /> {kind === "missing" ? "Encontradas" : "Egresados"}</th>
              <th className="px-3 py-2 text-right"><Clock className="h-3 w-3 inline" /> Último</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={`${r.kind}:${r.source_label}`} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-semibold">{r.source_label}</td>
                <td className="px-3 py-2 text-right">{fmt(r.total)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.with_photo)} <span className="text-muted-foreground">({pct(r.with_photo, r.total)})</span></td>
                {kind === "missing" && (
                  <td className="px-3 py-2 text-right">{fmt(r.with_coords)} <span className="text-muted-foreground">({pct(r.with_coords, r.total)})</span></td>
                )}
                <td className="px-3 py-2 text-right">{fmt(r.matched)} <span className="text-muted-foreground">({pct(r.matched, r.total)})</span></td>
                <td className="px-3 py-2 text-right">{fmt(r.found)} <span className="text-muted-foreground">({pct(r.found, r.total)})</span></td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                  {r.last_created ? formatDistanceToNow(new Date(r.last_created), { addSuffix: true, locale: es }) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={kind === "missing" ? 7 : 6} className="p-4 text-center text-muted-foreground">Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
