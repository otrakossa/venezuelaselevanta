import { cn } from "@/lib/utils";

/**
 * Corazón "Venezuela Se Levanta" latiendo — indicador de carga liviano.
 * Un solo <path> SVG (silueta del favicon) + animación CSS. Sin imágenes.
 */
export function HeartbeatLoader({
  className,
  label = "Cargando…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 618 540"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-6 text-[hsl(var(--sunrise,14_100%_60%))] animate-heartbeat", className)}
      fill="currentColor"
    >
      <path d="M528.33,17.71c-21.8-10.56-45.01-15.71-67.95-15.71-78.72,0-135.33,60.56-151.82,92.19C292.06,62.56,235.46,2,156.74,2c-22.94,0-46.15,5.15-67.95,15.71C37.64,42.53,2.05,95.7,2,155.43c0,5.62.26,11.19.73,16.7.26,2.91.57,5.78.94,8.64,2.45,19.15,7.6,37.83,14.57,56.3,14.83,39.23,39.07,77.47,68.78,113.68,2.45,2.97,4.89,5.88,7.39,8.79,61.08,71.59,142.72,134.29,212.8,178.31h2.71c70.08-44.02,151.72-106.71,212.8-178.31,2.5-2.91,4.94-5.83,7.39-8.79,29.71-36.21,53.95-74.45,68.78-113.68,6.97-18.47,12.12-37.15,14.57-56.3.36-2.86.68-5.72.94-8.64.47-5.51.73-11.08.73-16.7-.05-59.73-35.64-112.9-86.79-137.72Z" />
    </svg>
  );
}

export default HeartbeatLoader;
