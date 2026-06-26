import { useEffect, useRef, useState } from "react";
import { ThumbsUp, ThumbsDown, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device-id";
import { getCredibility } from "@/lib/credibility";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Report, VoteKind } from "@/lib/types";

interface Props {
  report: Pick<Report, "id" | "verified" | "confirm_count" | "dispute_count">;
  variant?: "compact" | "full";
  showBadge?: boolean;
}

export function ReportRating({ report, variant = "compact", showBadge = true }: Props) {
  const [myVote, setMyVote] = useState<VoteKind | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // local optimistic deltas (parent will refresh via realtime)
  const [delta, setDelta] = useState({ confirm: 0, dispute: 0 });
  const cred = getCredibility({
    verified: report.verified,
    confirm_count: (report.confirm_count ?? 0) + delta.confirm,
    dispute_count: (report.dispute_count ?? 0) + delta.dispute,
  });

  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) return;
    let mounted = true;
    supabase
      .from("report_votes")
      .select("vote")
      .eq("report_id", report.id)
      .eq("device_id", deviceId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted && data) setMyVote(data.vote as VoteKind);
      });
    return () => {
      mounted = false;
    };
  }, [report.id]);

  const cast = async (vote: VoteKind) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const deviceId = getDeviceId();
    if (!deviceId) { busyRef.current = false; return; }
    setBusy(true);
    const prev = myVote;

    // optimistic
    let cDelta = 0;
    let dDelta = 0;
    if (prev === vote) {
      // toggle off
      if (vote === "confirm") cDelta = -1; else dDelta = -1;
      setMyVote(null);
    } else if (prev) {
      // switch
      if (prev === "confirm") cDelta -= 1; else dDelta -= 1;
      if (vote === "confirm") cDelta += 1; else dDelta += 1;
      setMyVote(vote);
    } else {
      if (vote === "confirm") cDelta = 1; else dDelta = 1;
      setMyVote(vote);
    }
    setDelta((d) => ({ confirm: d.confirm + cDelta, dispute: d.dispute + dDelta }));

    try {
      const { error } = await supabase.rpc("cast_report_vote" as never, {
        p_report_id: report.id,
        p_device_id: deviceId,
        p_vote: prev === vote ? "none" : vote,
      } as never);
      if (error) throw error;
    } catch (e) {

      // revert optimistic
      setMyVote(prev);
      setDelta((d) => ({ confirm: d.confirm - cDelta, dispute: d.dispute - dDelta }));
      toast.error("No se pudo registrar tu valoración");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const confirmCount = (report.confirm_count ?? 0) + delta.confirm;
  const disputeCount = (report.dispute_count ?? 0) + delta.dispute;

  const sizeBtn =
    variant === "full"
      ? "px-3 py-2 text-sm gap-2"
      : "px-2 py-1 text-[11px] gap-1";

  return (
    <div className={cn("flex flex-col gap-1.5", variant === "full" && "gap-2")}>
      {showBadge && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-semibold",
              variant === "full" ? "text-xs px-2.5 py-1" : "text-[10px] px-1.5 py-0.5",
            )}
            style={{ background: cred.bg, color: cred.fg }}
            title={cred.label}
          >
            {cred.level === "verified" && <BadgeCheck className={variant === "full" ? "h-3.5 w-3.5" : "h-3 w-3"} />}
            {cred.short}
          </span>
          {variant === "full" && cred.total > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {cred.total} {cred.total === 1 ? "voto" : "votos"}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void cast("confirm");
          }}
          className={cn(
            "inline-flex items-center rounded-full border font-semibold transition",
            sizeBtn,
            myVote === "confirm"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-card text-foreground border-border hover:bg-emerald-50 hover:border-emerald-300",
          )}
          aria-pressed={myVote === "confirm"}
          aria-label="Confirmo este reporte"
        >
          <ThumbsUp className={variant === "full" ? "h-4 w-4" : "h-3 w-3"} />
          <span>{confirmCount}</span>
          {variant === "full" && <span className="hidden sm:inline">Confirmo</span>}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void cast("dispute");
          }}
          className={cn(
            "inline-flex items-center rounded-full border font-semibold transition",
            sizeBtn,
            myVote === "dispute"
              ? "bg-rose-500 text-white border-rose-500"
              : "bg-card text-foreground border-border hover:bg-rose-50 hover:border-rose-300",
          )}
          aria-pressed={myVote === "dispute"}
          aria-label="Dudo de este reporte"
        >
          <ThumbsDown className={variant === "full" ? "h-4 w-4" : "h-3 w-3"} />
          <span>{disputeCount}</span>
          {variant === "full" && <span className="hidden sm:inline">Dudo</span>}
        </button>
      </div>
    </div>
  );
}
