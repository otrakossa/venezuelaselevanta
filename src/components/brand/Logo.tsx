import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  variant?: "color" | "light" | "dark";
  className?: string;
  tagline?: boolean;
}

/**
 * Venezuela Se Levanta — logo "Corazón-Venezuela"
 * Heart shape with a heartbeat pulse line. Wordmark optional.
 */
export function Logo({
  size = 36,
  withWordmark = true,
  variant = "color",
  className,
  tagline = false,
}: LogoProps) {
  const wordPrimary =
    variant === "light"
      ? "text-white"
      : variant === "dark"
        ? "text-[color:var(--midnight)]"
        : "text-[color:var(--midnight)] dark:text-white";
  const wordAccent =
    variant === "light"
      ? "text-vzla-yellow"
      : "text-[color:var(--sunrise)]";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark size={size} variant={variant} />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-display font-black tracking-tight text-[1.05em]", wordPrimary)}>
            Venezuela <span className={wordAccent}>Se Levanta</span>
          </span>
          {tagline && (
            <span
              className={cn(
                "mt-1 text-[10px] font-medium tracking-wide uppercase opacity-70",
                variant === "light" ? "text-white" : "text-current",
              )}
            >
              Mapa colaborativo de crisis
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export function Mark({
  size = 36,
  variant = "color",
}: {
  size?: number;
  variant?: "color" | "light" | "dark";
}) {
  const gradientId = `vsl-grad-${variant}`;
  const heartFill =
    variant === "light"
      ? "#FFF8F0"
      : variant === "dark"
        ? "#0D2B45"
        : `url(#${gradientId})`;
  const pulseStroke = variant === "color" ? "#FFF8F0" : variant === "light" ? "#0D2B45" : "#FFC93C";
  const sunFill = variant === "light" ? "#FFC93C" : variant === "dark" ? "#FF6B35" : "#FFC93C";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Venezuela Se Levanta"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC93C" />
          <stop offset="0.55" stopColor="#FF6B35" />
          <stop offset="1" stopColor="#E0451F" />
        </linearGradient>
      </defs>

      {/* rising sun behind heart */}
      <circle cx="32" cy="24" r="9" fill={sunFill} opacity={variant === "color" ? 0.9 : 0.85} />
      {/* sun rays */}
      <g stroke={sunFill} strokeWidth="2" strokeLinecap="round" opacity={variant === "color" ? 0.7 : 0.6}>
        <line x1="32" y1="6" x2="32" y2="11" />
        <line x1="14" y1="10" x2="17" y2="14" />
        <line x1="50" y1="10" x2="47" y2="14" />
        <line x1="8" y1="22" x2="13" y2="22" />
        <line x1="56" y1="22" x2="51" y2="22" />
      </g>

      {/* heart shape */}
      <path
        d="M32 56 C 14 44, 6 34, 6 24 C 6 16, 12 10, 19 10 C 24 10, 29 13, 32 18 C 35 13, 40 10, 45 10 C 52 10, 58 16, 58 24 C 58 34, 50 44, 32 56 Z"
        fill={heartFill}
        stroke={variant === "color" ? "#0D2B45" : pulseStroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* heartbeat pulse line crossing the heart */}
      <path
        d="M10 32 L20 32 L24 24 L28 40 L32 28 L36 36 L40 32 L54 32"
        fill="none"
        stroke={pulseStroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
