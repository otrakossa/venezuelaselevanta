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
  const wordAccent = "text-[color:var(--sunrise)]";


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
  const uid = Math.random().toString(36).slice(2, 8);
  const gradientId = `vsl-grad-${variant}-${uid}`;
  const heartFill =
    variant === "dark"
      ? "#0D2B45"
      : `url(#${gradientId})`;


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
        <linearGradient id={gradientId} x1="10" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC93C" />
          <stop offset="0.5" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#FF4F1F" />
        </linearGradient>
      </defs>
      <path
        d="M32 56 C 14 44, 6 34, 6 24 C 6 16, 12 10, 19 10 C 24 10, 29 13, 32 18 C 35 13, 40 10, 45 10 C 52 10, 58 16, 58 24 C 58 34, 50 44, 32 56 Z"
        fill={heartFill}
      />
    </svg>
  );
}
