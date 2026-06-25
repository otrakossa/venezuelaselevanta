import { useEffect, useRef, useState } from "react";

interface Options {
  onRefresh: () => void | Promise<void>;
  threshold?: number; // px to trigger
  enabled?: boolean;
}

/**
 * Lightweight pull-to-refresh for mobile scrollable containers.
 * Only fires when the container is scrolled to the top.
 */
export function usePullToRefresh<T extends HTMLElement>({
  onRefresh,
  threshold = 72,
  enabled = true,
}: Options) {
  const ref = useRef<T | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    // Skip on non-touch devices.
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    const onStart = (e: TouchEvent) => {
      if (el.scrollTop > 0 || refreshing) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      active.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // resist
      const eased = Math.min(140, dy * 0.55);
      setPull(eased);
    };
    const onEnd = async () => {
      if (!active.current) return;
      active.current = false;
      const triggered = pull >= threshold;
      setPull(0);
      startY.current = null;
      if (triggered && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setTimeout(() => setRefreshing(false), 350);
        }
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, onRefresh, pull, refreshing, threshold]);

  return { ref, pull, refreshing, threshold };
}
