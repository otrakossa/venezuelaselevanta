import { cn } from "@/lib/utils";
import tsunamiAsset from "@/assets/tsunami.svg.asset.json";

type Mood = "idle" | "thinking" | "hero" | "static";

interface Props {
  size?: number;
  mood?: Mood;
  className?: string;
  /** show a soft radial halo behind the avatar */
  halo?: boolean;
}

/**
 * Tsunami — mascota oficial del agente.
 * Usa el SVG vectorizado oficial servido desde CDN.
 */
export function TsunamiAvatar({ size = 40, mood = "idle", className, halo = false }: Props) {
  const isHero = mood === "hero";
  const wrapSize = isHero ? size * 1.35 : size;

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center shrink-0",
        className,
      )}
      style={{ width: wrapSize, height: wrapSize }}
      aria-hidden
    >
      {(halo || isHero) && (
        <>
          <span
            className={cn(
              "absolute inset-0 rounded-full",
              mood === "thinking" ? "animate-tsunami-halo" : "animate-tsunami-halo-slow",
            )}
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in oklab, var(--sunrise) 55%, transparent) 0%, color-mix(in oklab, var(--gold) 30%, transparent) 35%, transparent 70%)",
              filter: "blur(6px)",
            }}
          />
          {isHero && (
            <span
              className="absolute inset-0 rounded-full animate-tsunami-ring"
              style={{
                border: "2px solid color-mix(in oklab, var(--sunrise) 50%, transparent)",
              }}
            />
          )}
        </>
      )}
      <img
        src={tsunamiAsset.url}
        alt="Tsunami, asistente de rescate"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn(
          "relative drop-shadow-[0_4px_10px_rgba(255,107,53,0.25)]",
          mood === "idle" && "animate-tsunami-float",
          mood === "thinking" && "animate-tsunami-sniff",
          mood === "hero" && "animate-tsunami-float-lg",
        )}
      />
    </span>
  );
}
