import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Square, Trash2, WifiOff } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STORAGE_KEY = "tsunami:messages:v1";

export const Route = createFileRoute("/tsunami")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tsunami — Asistente (beta privada)" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TsunamiPage,
});

function loadInitial(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const QUICK_ACTIONS: Array<{ label: string; prompt: string; emoji: string }> = [
  { emoji: "🔎", label: "Buscar persona", prompt: "Quiero buscar a un familiar desaparecido" },
  { emoji: "📝", label: "Registrar desaparecido", prompt: "Necesito registrar a una persona desaparecida" },
  { emoji: "🆘", label: "Ver necesidades", prompt: "Muéstrame qué necesidades hay activas ahora mismo" },
  { emoji: "🤝", label: "Ofrecer ayuda", prompt: "Quiero ofrecer ayuda, guíame paso a paso" },
];

const EMPTY_SECTIONS: Array<{
  title: string;
  emoji: string;
  items: Array<{ label: string; sub: string; prompt: string }>;
}> = [
  {
    title: "Buscar a alguien",
    emoji: "🔎",
    items: [
      { label: "Buscar por nombre", sub: "Te ayudo a rastrear a un familiar", prompt: "Quiero buscar a una persona desaparecida por su nombre" },
      { label: "Buscar por cédula", sub: "Si tienes el número de cédula", prompt: "Tengo la cédula de la persona que busco, ayúdame" },
      { label: "Ver si está en un hospital", sub: "Cruce con pacientes atendidos", prompt: "Quiero ver si mi familiar está atendido en algún hospital" },
    ],
  },
  {
    title: "Ayudar",
    emoji: "🤝",
    items: [
      { label: "Ver necesidades activas", sub: "Qué falta y dónde", prompt: "Muéstrame las necesidades activas" },
      { label: "Ofrecer ayuda concreta", sub: "Insumos, transporte, hospedaje…", prompt: "Quiero ofrecer ayuda, guíame paso a paso" },
      { label: "Registrar a un desaparecido", sub: "Si conoces a alguien que falta", prompt: "Quiero registrar a una persona desaparecida" },
    ],
  },
];

const PLACEHOLDERS = [
  "Escríbele a Tsunami…",
  "Ej: Busca a Juan Pérez",
  "Ej: Tengo medicinas para donar en Caracas",
  "Ej: Cédula 12345678",
  "Ej: ¿Qué necesidades hay en Maracay?",
];

function TsunamiPage() {
  const [initial] = useState<UIMessage[]>(() => loadInitial());
  const [input, setInput] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, error, setMessages, stop, regenerate } = useChat({
    id: "tsunami-single",
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/tsunami" }),
    onError: (e) => {
      const msg = e.message || "Algo salió mal";
      if (msg.includes("429")) toast.error("Demasiadas solicitudes. Intenta de nuevo en unos segundos.");
      else if (msg.includes("402")) toast.error("Créditos AI agotados. Avisa al equipo.");
      else toast.error(msg);
    },
  });

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* noop */
    }
  }, [messages]);

  // Focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, [status]);

  // Online/offline
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Rotate placeholder while empty
  useEffect(() => {
    if (input.length > 0) return;
    const id = window.setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => window.clearInterval(id);
  }, [input.length]);

  const busy = status === "submitted" || status === "streaming";
  const streaming = status === "streaming";

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const reset = () => {
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setConfirmReset(false);
    textareaRef.current?.focus();
  };

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const showQuickChips = messages.length > 0 && messages.length <= 6;

  return (
    <div
      className="flex flex-col h-[100dvh] bg-background"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, color-mix(in oklab, var(--sunrise) 4%, transparent), transparent 60%), radial-gradient(ellipse at bottom, color-mix(in oklab, var(--sky) 4%, transparent), transparent 60%)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3 bg-card/80 backdrop-blur"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[color:var(--sunrise)] to-amber-400 flex items-center justify-center text-2xl shadow-sm shrink-0">
            🐶
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base leading-tight flex items-center gap-2">
              <span className="truncate">Tsunami</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded shrink-0">
                Beta
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {messages.length > 0
                ? `${messages.length} mensaje${messages.length === 1 ? "" : "s"} · solo tú los ves`
                : "Tu perrito de rescate en línea 🐾"}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmReset(true)}
            className="gap-1.5 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        )}
      </header>

      {!online && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs bg-amber-50 text-amber-900 border-b border-amber-200">
          <WifiOff className="h-3.5 w-3.5" />
          Sin conexión — Tsunami responderá cuando vuelvas en línea.
        </div>
      )}

      {/* Conversation */}
      <Conversation className="flex-1 overflow-hidden">
        <ConversationContent className="max-w-3xl mx-auto w-full px-3 py-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<div className="text-6xl">🐶</div>}
              title={`${greet()}, soy Tsunami`}
              description="Te ayudo a buscar familiares, registrar desaparecidos, ver necesidades activas o guiarte para ofrecer ayuda. Solo tú ves esta conversación en este navegador."
            >
              <div className="grid sm:grid-cols-2 gap-4 mt-6 w-full max-w-2xl">
                {EMPTY_SECTIONS.map((sec) => (
                  <div key={sec.title} className="rounded-xl border bg-card/60 p-3">
                    <div className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <span>{sec.emoji}</span>
                      <span>{sec.title}</span>
                    </div>
                    <div className="space-y-1.5">
                      {sec.items.map((it) => (
                        <button
                          key={it.label}
                          onClick={() => send(it.prompt)}
                          className="block w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium">{it.label}</div>
                          <div className="text-xs text-muted-foreground">{it.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => {
            const isAssistant = m.role === "assistant";
            const isLastAssistant = isAssistant && m.id === lastAssistantId;
            const textForCopy = m.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("\n")
              .trim();

            return (
              <div key={m.id} className={isAssistant ? "flex gap-2.5 items-start" : ""}>
                {isAssistant && (
                  <div
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-[color:var(--sunrise)] to-amber-400 flex items-center justify-center text-base shadow-sm shrink-0 mt-1"
                    aria-hidden
                  >
                    🐶
                  </div>
                )}
                <Message from={m.role} className={isAssistant ? "flex-1 min-w-0" : ""}>
                  <MessageContent
                    className={
                      isAssistant
                        ? "bg-transparent p-0 shadow-none"
                        : "bg-primary text-primary-foreground"
                    }
                  >
                    {m.parts.map((part, i) => {
                      if (part.type === "text") {
                        return isAssistant ? (
                          <MessageResponse key={i}>{part.text}</MessageResponse>
                        ) : (
                          <span key={i} className="whitespace-pre-wrap">
                            {(part as { text: string }).text}
                          </span>
                        );
                      }
                      if (part.type?.startsWith("tool-")) {
                        const p = part as {
                          type: string;
                          state?: string;
                          input?: unknown;
                          output?: unknown;
                          errorText?: string;
                        };
                        const toolName = part.type.replace(/^tool-/, "");
                        const state =
                          p.state === "output-available"
                            ? "output-available"
                            : p.state === "output-error"
                              ? "output-error"
                              : p.state === "input-available"
                                ? "input-available"
                                : "input-streaming";
                        const hasOutput = p.output !== undefined || Boolean(p.errorText);
                        const title = toolSummary(toolName, p.input, p.output, state);
                        return (
                          <div key={i} className="space-y-2">
                            {/* Rich ficha rendered inline (outside accordion) */}
                            {hasOutput && !p.errorText && (
                              <div>{renderToolOutput(toolName, p.output, p.input, send)}</div>
                            )}
                            {/* Compact accordion with raw debug */}
                            <Tool defaultOpen={false}>
                              <ToolHeader
                                type={`tool-${toolName}`}
                                state={state as never}
                                title={title}
                              />
                              <ToolContent>
                                <ToolInput input={p.input} />
                                {hasOutput && (
                                  <ToolOutput output={p.output} errorText={p.errorText} />
                                )}
                              </ToolContent>
                            </Tool>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>

                  {isAssistant && textForCopy && (
                    <div className="flex gap-1 mt-1 opacity-60 hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(textForCopy);
                          toast.success("Copiado");
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent"
                        aria-label="Copiar respuesta"
                      >
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                      {isLastAssistant && !busy && (
                        <button
                          type="button"
                          onClick={() => regenerate()}
                          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent"
                          aria-label="Regenerar respuesta"
                        >
                          <RefreshCw className="h-3 w-3" /> Regenerar
                        </button>
                      )}
                    </div>
                  )}
                </Message>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex gap-2.5 items-start">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[color:var(--sunrise)] to-amber-400 flex items-center justify-center text-base shadow-sm shrink-0 mt-1">
                🐶
              </div>
              <Message from="assistant" className="flex-1 min-w-0">
                <MessageContent className="bg-transparent p-0 shadow-none">
                  <Shimmer>Tsunami está pensando…</Shimmer>
                </MessageContent>
              </Message>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <span className="min-w-0 truncate">⚠️ {error.message}</span>
              <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => regenerate()}>
                Reintentar
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div
        className="border-t bg-background/95 backdrop-blur"
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto w-full p-3 space-y-2">
          {showQuickChips && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible scrollbar-thin">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => send(a.prompt)}
                  disabled={busy}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-full border bg-card hover:bg-accent hover:border-[color:var(--sunrise)] transition-colors disabled:opacity-50"
                >
                  <span className="mr-1">{a.emoji}</span>
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <PromptInput
            onSubmit={(msg) => {
              send(msg.text ?? "");
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              autoFocus
            />
            <PromptInputFooter className="justify-between">
              <div className="text-[11px] text-muted-foreground">
                {input.length > 500 && `${input.length} caracteres`}
              </div>
              {streaming ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => stop()}
                  className="gap-1.5"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Detener
                </Button>
              ) : (
                <PromptInputSubmit status={status} disabled={busy || !input.trim()} />
              )}
            </PromptInputFooter>
          </PromptInput>
          <p className="text-[11px] text-muted-foreground text-center">
            Tsunami está en pruebas. Si necesitas ayuda urgente visita{" "}
            <Link to="/" className="underline">
              venezuelaselevanta.info
            </Link>
            .
          </p>
        </div>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Iniciar nueva conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán los mensajes actuales con Tsunami en este navegador. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>Sí, borrar y empezar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Human-readable summary for the tool accordion header.
function toolSummary(toolName: string, input: unknown, output: unknown, state: string): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const out = (output ?? {}) as Record<string, unknown>;
  const done = state === "output-available";
  const failed = state === "output-error";
  const verb = done ? "" : failed ? "Error: " : "Buscando ";

  switch (toolName) {
    case "search_missing_persons": {
      const q = String(inp.query ?? inp.name ?? "").trim();
      const n = Array.isArray(out.results) ? out.results.length : null;
      if (done) return `🔍 ${n ?? 0} resultado${n === 1 ? "" : "s"}${q ? ` para "${q}"` : ""}`;
      return `🔍 ${verb}personas${q ? ` "${q}"` : ""}…`;
    }
    case "get_missing_person":
      return done ? `📋 Ficha de ${String(out.name ?? "persona")}` : "📋 Cargando ficha…";
    case "suggest_patient_matches": {
      const n = Array.isArray(out.matches) ? out.matches.length : null;
      if (done) return `🏥 ${n ?? 0} coincidencia${n === 1 ? "" : "s"} en hospitales`;
      return "🏥 Buscando coincidencias en hospitales…";
    }
    case "register_missing_person":
      if (out.status === "ok") return "✅ Desaparecido registrado";
      if (out.status === "pending_confirmation") return "⚠️ Confirmación requerida";
      return "📝 Registrando…";
    case "list_needs": {
      const n = Array.isArray(out.results) ? out.results.length : null;
      if (done) return `🆘 ${n ?? 0} necesidad${n === 1 ? "" : "es"} activa${n === 1 ? "" : "s"}`;
      return "🆘 Buscando necesidades…";
    }
    case "get_need":
      return done ? `📋 ${String(out.title ?? "Necesidad")}` : "📋 Cargando necesidad…";
    case "guide_offer_help":
      return done ? "🤝 Guía para ofrecer ayuda" : "🤝 Preparando guía…";
    default:
      return toolName;
  }
}

// Rich inline "fichas" shown directly inside the chat for each tool result.
function renderToolOutput(
  toolName: string,
  output: unknown,
  _input: unknown,
  send: (text: string) => void,
): React.ReactNode {
  if (!output || typeof output !== "object") {
    return null;
  }
  const o = output as Record<string, unknown>;

  if (o.error && !o.results && !o.matches) {
    return <p className="text-sm text-destructive">⚠️ {String(o.error)}</p>;
  }

  if (toolName === "search_missing_persons" && Array.isArray(o.results)) {
    const results = o.results as Array<Record<string, unknown>>;
    if (results.length === 0) return <p className="text-sm text-muted-foreground">Sin resultados.</p>;
    return (
      <div className="space-y-2">
        {results.map((r) => (
          <MissingFicha key={String(r.id)} data={r} compact send={send} />
        ))}
      </div>
    );
  }

  if (toolName === "get_missing_person" && o.id) {
    return <MissingFicha data={o} send={send} />;
  }

  if (toolName === "suggest_patient_matches" && Array.isArray(o.matches)) {
    const matches = o.matches as Array<Record<string, unknown>>;
    const mpId = (o.missing_person_id as string) ?? "";
    const mpName = (o.missing_person_name as string) ?? "la persona buscada";
    if (matches.length === 0)
      return <p className="text-sm text-muted-foreground">Sin coincidencias en centros de salud.</p>;
    return <MatchList matches={matches} missingId={mpId} missingName={mpName} send={send} />;
  }

  if (toolName === "register_missing_person") {
    if (o.status === "pending_confirmation" && o.preview) {
      const p = o.preview as Record<string, unknown>;
      return (
        <div className="p-3 rounded-lg border-2 border-dashed border-[color:var(--sunrise)] bg-orange-50 space-y-1">
          <div className="text-xs font-bold text-orange-900 uppercase">
            ⚠️ Confirma estos datos antes de registrar
          </div>
          <DefList
            entries={[
              ["Nombre", p.full_name],
              ["Cédula", p.id_number],
              ["Edad", p.age],
              ["Estado", p.state],
              ["Municipio", p.municipality],
              ["Última ubicación", p.last_seen_location],
              ["Descripción", p.description],
              ["Contacto", p.contact_name],
              ["Teléfono", p.contact_phone],
            ]}
          />
        </div>
      );
    }
    if (o.status === "ok") {
      return (
        <div className="p-3 rounded-lg border bg-green-50 border-green-200 space-y-1">
          <div className="text-sm font-semibold text-green-900">✅ Registro creado</div>
          <div className="text-xs text-green-900/80">
            Ya quedó guardado en la plataforma. Sigamos por aquí si necesitas algo más. 🐾
          </div>
        </div>
      );
    }
  }

  if (toolName === "list_needs" && Array.isArray(o.results)) {
    const results = o.results as Array<Record<string, unknown>>;
    if (results.length === 0)
      return <p className="text-sm text-muted-foreground">No hay necesidades abiertas.</p>;
    return (
      <div className="space-y-2">
        {results.map((r) => (
          <NeedFicha key={String(r.id)} data={r} compact send={send} />
        ))}
      </div>
    );
  }

  if (toolName === "get_need" && o.id) {
    return <NeedFicha data={o} send={send} />;
  }

  if (toolName === "guide_offer_help" && Array.isArray(o.steps)) {
    const steps = o.steps as string[];
    return (
      <div className="space-y-2 p-3 rounded-lg border bg-card">
        <ol className="space-y-1.5 list-decimal pl-5 text-sm">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Cuéntame qué quieres ofrecer (categoría, cantidad, ciudad y tu contacto) y lo registramos aquí mismo. 🐾
        </p>
      </div>
    );
  }

  return null;
}

const DECISIONS_KEY = "tsunami:match-decisions:v1";
type Decision = "confirmed" | "discarded";
function loadDecisions(): Record<string, Decision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DECISIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Decision>) : {};
  } catch {
    return {};
  }
}
function saveDecisions(d: Record<string, Decision>) {
  try {
    window.localStorage.setItem(DECISIONS_KEY, JSON.stringify(d));
  } catch {
    /* noop */
  }
}

function MatchList({
  matches,
  missingId,
  missingName,
  send,
}: {
  matches: Array<Record<string, unknown>>;
  missingId: string;
  missingName: string;
  send: (text: string) => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => loadDecisions());

  const decide = (m: Record<string, unknown>, decision: Decision) => {
    const key = `${missingId}:${String(m.patient_id)}`;
    const next = { ...decisions, [key]: decision };
    setDecisions(next);
    saveDecisions(next);
    const patientName = String(m.patient_name ?? "el paciente");
    const center = m.center_name ? ` en ${String(m.center_name)}` : "";
    if (decision === "confirmed") {
      send(
        `✅ Confirmo que "${patientName}"${center} es la misma persona que ${missingName}. ¿Qué pasos sigo ahora para contactar al centro y notificar a la familia?`,
      );
    } else {
      send(
        `❌ Descarto que "${patientName}"${center} sea ${missingName}. No es la misma persona.`,
      );
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {matches.length} posible{matches.length === 1 ? "" : "s"} coincidencia
        {matches.length === 1 ? "" : "s"}. Revisa cada una y dime si es{" "}
        <strong>la misma persona</strong> o no:
      </p>
      {matches.map((m) => {
        const key = `${missingId}:${String(m.patient_id)}`;
        const decision = decisions[key];
        const confidence = String(m.confidence ?? "baja");
        const conColor =
          confidence === "alta"
            ? "bg-green-100 text-green-900 border-green-300"
            : confidence === "media"
              ? "bg-amber-100 text-amber-900 border-amber-300"
              : "bg-slate-100 text-slate-800 border-slate-300";
        const reasons = Array.isArray(m.reasons) ? (m.reasons as string[]) : [];
        const scorePct =
          typeof m.score === "number" ? Math.round(Number(m.score) * 100) : null;
        return (
          <div
            key={String(m.patient_id)}
            className={`p-3 rounded-lg border bg-card space-y-2 ${
              decision === "discarded" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">
                  🏥 {String(m.patient_name ?? "Sin nombre")}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
                  {Boolean(m.center_name) && <div>📍 {String(m.center_name)}</div>}
                  {m.patient_age != null && <div>📅 {String(m.patient_age)} años</div>}
                  {Boolean(m.patient_id_number) && (
                    <div>🪪 Cédula: {String(m.patient_id_number)}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${conColor}`}
                >
                  Confianza {confidence}
                </span>
                {scorePct != null && (
                  <span className="text-[10px] text-muted-foreground">{scorePct}% similitud</span>
                )}
              </div>
            </div>

            {reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reasons.map((r, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground/80"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            {decision ? (
              <div
                className={`text-xs font-semibold ${
                  decision === "confirmed" ? "text-green-700" : "text-muted-foreground"
                }`}
              >
                {decision === "confirmed" ? "✅ Confirmada por ti" : "❌ Descartada por ti"}
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-9"
                  onClick={() => decide(m, "confirmed")}
                >
                  ✅ Es la misma persona
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9"
                  onClick={() => decide(m, "discarded")}
                >
                  ❌ No es
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MissingFicha({
  data,
  compact = false,
  send,
}: {
  data: Record<string, unknown>;
  compact?: boolean;
  send?: (text: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = data.photo_url && !imgFailed ? String(data.photo_url) : null;

  const status = data.status ? String(data.status) : null;
  const statusColor =
    status === "found"
      ? "bg-green-100 text-green-900"
      : status === "deceased"
        ? "bg-gray-200 text-gray-900"
        : "bg-amber-100 text-amber-900";

  const name = String(data.name ?? "esta persona");
  const id = data.id ? String(data.id) : null;
  const actionable = Boolean(send && id);

  const handleClick = () => {
    if (!send || !id) return;
    send(
      `Muéstrame la ficha completa de ${name} (id ${id}) y busca posibles coincidencias en hospitales.`,
    );
  };

  return (
    <div
      className={`rounded-lg border bg-card overflow-hidden transition ${
        actionable ? "cursor-pointer hover:border-[color:var(--sunrise)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sunrise)]" : ""
      }`}
      role={actionable ? "button" : undefined}
      tabIndex={actionable ? 0 : undefined}
      onClick={actionable ? handleClick : undefined}
      onKeyDown={
        actionable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="flex gap-3 p-3">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`${compact ? "h-16 w-16" : "h-24 w-24"} rounded object-cover bg-muted shrink-0`}
          />
        ) : (
          <div
            className={`${compact ? "h-16 w-16 text-2xl" : "h-24 w-24 text-4xl"} rounded bg-muted flex items-center justify-center shrink-0`}
          >
            🧑
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-sm">{String(data.name ?? "Sin nombre")}</div>
            {status && (
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColor}`}>
                {status === "missing" ? "Desaparecido" : status === "found" ? "Encontrado" : status}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {data.age != null && <div>📅 {String(data.age)} años</div>}
            {Boolean(data.id_number) && <div>🪪 Cédula: {String(data.id_number)}</div>}
            {Boolean(data.state || data.municipality) && (
              <div>📍 {[data.municipality, data.state].filter(Boolean).join(", ")}</div>
            )}
            {Boolean(data.last_seen_location) && !compact && (
              <div className="italic">Visto en: {String(data.last_seen_location)}</div>
            )}
          </div>
          {!compact && Boolean(data.description) && (
            <p className="text-xs text-foreground/80 mt-1 line-clamp-4">{String(data.description)}</p>
          )}
          {actionable && compact && (
            <div className="text-[11px] text-[color:var(--sunrise)] font-medium pt-0.5">
              Toca para ver ficha completa →
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NeedFicha({ data, compact = false }: { data: Record<string, unknown>; compact?: boolean }) {
  const urgencyColors: Record<string, string> = {
    critical: "bg-red-100 text-red-900",
    high: "bg-orange-100 text-orange-900",
    medium: "bg-amber-100 text-amber-900",
    low: "bg-blue-100 text-blue-900",
  };
  const urg = String(data.urgency ?? "");
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {Boolean(data.category) && (
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              {String(data.category)}
            </span>
          )}
          {Boolean(urg) && (
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${urgencyColors[urg] ?? "bg-muted"}`}>
              {urg}
            </span>
          )}
        </div>
        <div className="font-semibold text-sm">{String(data.title ?? "Necesidad")}</div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {Boolean(data.center_name) && <div>🏥 {String(data.center_name)}</div>}
          {Boolean(data.center_address) && <div>📍 {String(data.center_address)}</div>}
          {Boolean(data.quantity) && <div>🔢 Cantidad: {String(data.quantity)}</div>}
          {!compact && Boolean(data.contact_name) && (
            <div>👤 Contacto: {String(data.contact_name)}{data.contact_phone ? ` · ${String(data.contact_phone)}` : ""}</div>
          )}
        </div>
        {!compact && Boolean(data.description) && (
          <p className="text-xs text-foreground/80 line-clamp-4">{String(data.description)}</p>
        )}
      </div>
    </div>
  );
}

function DefList({ entries }: { entries: Array<[string, unknown]> }) {
  const rows = entries.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (rows.length === 0) return null;
  return (
    <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-muted-foreground">{k}</dt>
          <dd className="text-foreground">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
