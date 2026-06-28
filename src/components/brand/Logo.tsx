import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  variant?: "color" | "light" | "dark";
  className?: string;
  tagline?: boolean;
}

/**
 * Venezuela Se Levanta — logo oficial.
 * Usa los SVG oficiales: corazón (favicon) y lockup completo con wordmark.
 */
export function Logo({
  size = 36,
  withWordmark = true,
  variant = "color",
  className,
  tagline = false,
}: LogoProps) {
  if (withWordmark) {
    // Lockup oficial: corazón + wordmark vectorizado.
    // Mantiene la proporción del SVG (viewBox 2552x696 ≈ 3.67:1).
    const height = Math.round(size * 1.15);
    return (
      <span className={cn("inline-flex flex-col leading-none", className)}>
        <img
          src="/logo-vsl.svg"
          alt="Venezuela Se Levanta"
          height={height}
          style={{ height, width: "auto" }}
          className={cn(
            variant === "light" && "brightness-0 invert",
          )}
        />
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
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Mark size={size} variant={variant} />
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
  return (
    <img
      src="/favicon.svg"
      alt="Venezuela Se Levanta"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn(
        variant === "light" && "brightness-0 invert",
        variant === "dark" && "brightness-0",
      )}
    />
  );
}
