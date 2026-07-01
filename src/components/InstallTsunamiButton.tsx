import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

/**
 * Botón "Instalar Tsunami": dispara directamente el prompt nativo del navegador.
 * Si el navegador no expone `beforeinstallprompt` (iOS Safari, etc.), el botón
 * no se muestra para no pedirle al usuario que haga pasos manuales.
 */
export function InstallTsunamiButton({ compact = false }: { compact?: boolean }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
      toast.success("Tsunami quedó instalado en tu pantalla 🐾");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Ya instalado, o el navegador no soporta instalación programática: no mostramos nada.
  if (installed) return null;
  if (!evt) return null;

  const doInstall = async () => {
    if (!evt || busy) return;
    setBusy(true);
    try {
      await evt.prompt();
      const c = await evt.userChoice;
      if (c.outcome === "accepted") {
        setInstalled(true);
      }
      setEvt(null);
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={doInstall}
      disabled={busy}
      size={compact ? "sm" : "default"}
      className="gap-2 shrink-0 font-bold"
      style={{ background: "var(--sunrise)", color: "white" }}
    >
      <Download className="h-4 w-4" />
      {compact ? "Instalar" : "Instalar Tsunami"}
    </Button>
  );
}
