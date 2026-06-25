import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}

export function EmptyState({ icon, emoji, title, description, action, className, tone = "default" }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 rounded-2xl border border-dashed",
        tone === "muted" ? "border-border/60 bg-card/40" : "border-border bg-card/70",
        className,
      )}
    >
      <div
        className="w-14 h-14 rounded-full grid place-items-center mb-3 shadow-sm"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--sunrise) 22%, transparent), color-mix(in oklab, var(--gold) 12%, transparent))",
          color: "var(--midnight)",
        }}
      >
        {icon ?? (emoji ? <span className="text-2xl">{emoji}</span> : <span className="text-2xl">🌅</span>)}
      </div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
