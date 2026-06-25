import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "vsl-pwa-install-dismissed";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    // Already installed?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") dismiss();
    } catch {
      /* ignore */
    }
  };

  if (!visible || !evt) return null;

  return (
    <div
      className="md:hidden fixed left-2 right-2 z-[960] rounded-xl shadow-2xl border border-white/10 px-3 py-2.5 flex items-center gap-2 text-xs"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)",
        background: "#0D2B45",
        color: "#FFF8F0",
      }}
    >
      <span className="text-base shrink-0">📲</span>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="font-bold">Instala Venezuela Se Levanta</div>
        <div className="opacity-80 text-[11px]">Funciona sin internet</div>
      </div>
      <button
        onClick={install}
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-white text-xs font-bold"
        style={{ background: "#FF6B35" }}
      >
        <Download className="h-3.5 w-3.5" /> Instalar
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded-md hover:bg-white/10 text-white/80"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
