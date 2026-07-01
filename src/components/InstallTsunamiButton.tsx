import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "tsunami-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua) === false
    ? /iPhone|iPad|iPod/.test(ua)
    : /iPhone|iPad|iPod/.test(ua);
}

/**
 * Botón "Instalar Tsunami": usa el manifest alternativo montado en la ruta
 * (start_url = /tsunami) para que el ícono en el escritorio del teléfono
 * sea el de Tsunami y abra directo el asistente.
 */
export function InstallTsunamiButton({ compact = false }: { compact?: boolean }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInstalled(isStandalone());
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* noop */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const ios = isIOS();
  // Ocultar si ya no aplica ninguna vía y el usuario descartó
  if (!evt && !ios && dismissed) return null;

  const doInstall = async () => {
    if (evt) {
      try {
        await evt.prompt();
        const c = await evt.userChoice;
        if (c.outcome === "accepted") setInstalled(true);
      } catch {
        /* noop */
      }
      return;
    }
    if (ios) {
      setShowIOS(true);
      return;
    }
    // Fallback desktop/otros: mostrar instrucciones también
    setShowIOS(true);
  };

  return (
    <>
      <Button
        onClick={doInstall}
        size={compact ? "sm" : "default"}
        className="gap-2 shrink-0 font-bold"
        style={{ background: "var(--sunrise)", color: "white" }}
      >
        <Download className="h-4 w-4" />
        {compact ? "Instalar" : "Instalar Tsunami"}
      </Button>

      <Dialog open={showIOS} onOpenChange={setShowIOS}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img
                src="/tsunami-icon-192.png?v=1"
                alt=""
                className="h-8 w-8 rounded-lg"
              />
              Instala Tsunami en tu pantalla
            </DialogTitle>
            <DialogDescription>
              Tendrás un ícono de Tsunami en el escritorio del teléfono que abre el asistente directamente, incluso sin abrir el navegador.
            </DialogDescription>
          </DialogHeader>

          {ios ? (
            <ol className="space-y-3 text-sm mt-2">
              <li className="flex items-start gap-3">
                <span className="size-6 rounded-full bg-[color:var(--sunrise)] text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Toca el botón <Share className="inline h-4 w-4 mx-0.5" /> <b>Compartir</b> en la barra de Safari.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="size-6 rounded-full bg-[color:var(--sunrise)] text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Desplázate y toca <b>Agregar a pantalla de inicio</b> <Plus className="inline h-4 w-4" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="size-6 rounded-full bg-[color:var(--sunrise)] text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Confirma con <b>Agregar</b>. Verás el ícono de Tsunami 🐾 listo para usar.
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm mt-2">
              <li className="flex items-start gap-3">
                <span className="size-6 rounded-full bg-[color:var(--sunrise)] text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  En el menú del navegador (⋮) toca <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="size-6 rounded-full bg-[color:var(--sunrise)] text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
                  2
                </span>
                <span>Confirma. El ícono de Tsunami quedará en tu pantalla principal.</span>
              </li>
            </ol>
          )}

          <button
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_KEY, "1");
              } catch {
                /* noop */
              }
              setDismissed(true);
              setShowIOS(false);
            }}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start"
          >
            <X className="h-3 w-3" /> No volver a mostrar
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
