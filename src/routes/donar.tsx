import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, CreditCard, Server, Map as MapIcon, Radio, AlertTriangle, Wallet } from "lucide-react";
import heroImage from "@/assets/hero-amanecer.jpg";

export const Route = createFileRoute("/donar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Donar · Venezuela Se Levanta" },
      {
        name: "description",
        content:
          "Apoya la respuesta al terremoto de Venezuela. Acepta USDT TRC20, próximamente Stripe, PayPal y Zelle.",
      },
      { property: "og:title", content: "Donar · Venezuela Se Levanta" },
      {
        property: "og:description",
        content:
          "Apoya la respuesta al terremoto de Venezuela. Acepta USDT TRC20, próximamente Stripe, PayPal y Zelle.",
      },
    ],
  }),
  component: DonarPage,
});

const USDT_ADDRESS = "TAWBVafs46F4VrxhKWprEmEfhCNfcjp5XU";

function DonarPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, USDT_ADDRESS, {
        width: 200,
        margin: 1,
        color: { dark: "#0D2B45", light: "#FFFFFF" },
      }).catch(() => {});
    }
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(USDT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ backgroundColor: "var(--midnight)" }}
      >
        <img
          src={heroImage}
          alt="Amanecer sobre Venezuela"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(13,43,69,0.94) 0%, rgba(13,43,69,0.78) 50%, rgba(13,43,69,0.5) 100%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-[color:var(--cream)]">
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] bg-[color:var(--sunrise)]/20 border border-[color:var(--sunrise)]/40 text-[color:var(--gold)] px-2.5 py-1 rounded-full">
            <Wallet className="h-3 w-3" /> Donaciones
          </span>
          <h1 className="font-display text-3xl sm:text-5xl mt-3 leading-tight">
            Apoya la respuesta al <span className="text-[color:var(--sunrise)]">terremoto</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/80 max-w-2xl">
            Cada donación ayuda a mantener esta plataforma activa y coordinar ayuda en tiempo real
            para las víctimas.
          </p>
        </div>
      </section>

      {/* Payment methods */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* USDT — Active */}
        <div className="rounded-2xl border-2 border-[#26A17B]/40 bg-card shadow-lg overflow-hidden">
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-white text-lg shrink-0"
                  style={{ backgroundColor: "#26A17B" }}
                >
                  ₮
                </div>
                <div>
                  <h2 className="font-display text-xl sm:text-2xl">USDT (TRC20)</h2>
                  <p className="text-xs text-muted-foreground">Tether sobre red Tron</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Disponible ahora
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Envía USDT en la red TRC20 (Tron). Rápido, sin comisiones bancarias.
            </p>

            <div className="mt-5 grid sm:grid-cols-[auto_1fr] gap-5 items-start">
              <div className="bg-white p-2 rounded-lg border border-border self-center mx-auto sm:mx-0">
                <canvas ref={canvasRef} width={200} height={200} />
              </div>
              <div className="space-y-3 min-w-0">
                <div className="bg-[color:var(--midnight)] text-[color:var(--cream)] rounded-lg p-3 font-mono text-xs sm:text-sm break-all">
                  {USDT_ADDRESS}
                </div>
                <button
                  onClick={copy}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[color:var(--sunrise)] hover:opacity-90 text-white font-semibold text-sm transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> ¡Copiado! ✓
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copiar dirección
                    </>
                  )}
                </button>
                <div className="flex items-start gap-2 text-xs sm:text-sm bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-300 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Solo envíes USDT en la red <strong>TRC20 (Tron)</strong>. Envíos en otras redes
                    se perderán.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming soon grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          <ComingSoonCard
            title="Tarjeta de crédito / débito"
            subtitle="Stripe"
            description="Pronto podrás donar con Visa o Mastercard directamente en la plataforma."
            icon={<CreditCard className="h-6 w-6 text-white" />}
            iconBg="linear-gradient(135deg,#635BFF,#0A2540)"
          />
          <ComingSoonCard
            title="PayPal"
            subtitle="Diáspora venezolana"
            description="Donaciones vía PayPal para la diáspora venezolana."
            icon={<span className="font-bold text-white text-lg italic">P</span>}
            iconBg="#003087"
          />
          <ComingSoonCard
            title="Zelle & Pago Móvil"
            subtitle="EEUU y Venezuela"
            description="Para venezolanos en EEUU (Zelle) y dentro de Venezuela (Pago Móvil)."
            icon={<span className="font-bold text-white text-lg">Z</span>}
            iconBg="#6D1ED4"
            wide
          />
        </div>
      </section>

      {/* Transparency */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
          <h2 className="font-display text-2xl sm:text-3xl text-center">
            ¿Para qué se usan las donaciones?
          </h2>
          <div className="mt-8 grid sm:grid-cols-3 gap-5">
            <TransparencyItem
              icon={<Server className="h-7 w-7 text-[color:var(--sky)]" />}
              title="Servidores"
              text="Mantener la plataforma disponible 24/7"
            />
            <TransparencyItem
              icon={<MapIcon className="h-7 w-7 text-[color:var(--sunrise)]" />}
              title="Cartografía"
              text="Datos del mapa actualizados en tiempo real"
            />
            <TransparencyItem
              icon={<Radio className="h-7 w-7 text-[color:var(--gold)]" />}
              title="Comunicación"
              text="Coordinación con equipos de rescate en campo"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ComingSoonCard({
  title,
  subtitle,
  description,
  icon,
  iconBg,
  wide,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 opacity-60 ${wide ? "sm:col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-display text-lg leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border px-2 py-1 rounded-full">
          Próximamente
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <button
        disabled
        className="mt-4 w-full px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed"
      >
        Disponible pronto
      </button>
    </div>
  );
}

function TransparencyItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center sm:text-left bg-card border border-border rounded-xl p-5">
      <div className="flex justify-center sm:justify-start">{icon}</div>
      <h3 className="font-display text-lg mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{text}</p>
    </div>
  );
}
