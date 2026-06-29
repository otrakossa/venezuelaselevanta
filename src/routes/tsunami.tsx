import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

const SUGGESTIONS = [
  "Estoy buscando a un familiar desaparecido",
  "Quiero registrar a una persona desaparecida",
  "¿Qué necesidades hay activas ahora?",
  "Quiero ofrecer ayuda",
];

function TsunamiPage() {
  const [initial] = useState<UIMessage[]>(() => loadInitial());
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
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

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* noop */
    }
  }, [messages]);

  // Keep textarea focused
  useEffect(() => {
    textareaRef.current?.focus();
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

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
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[color:var(--sunrise)] to-amber-400 flex items-center justify-center text-2xl shadow-sm">
            🐶
          </div>
          <div>
            <div className="font-bold text-base leading-tight flex items-center gap-2">
              Tsunami
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                Beta privada
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Tu perrito de rescate en línea 🐾</div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Nueva conversación
          </Button>
        )}
      </header>

      {/* Conversation */}
      <Conversation className="flex-1 overflow-hidden">
        <ConversationContent className="max-w-3xl mx-auto w-full px-3 py-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<div className="text-6xl">🐶</div>}
              title="¡Hola! Soy Tsunami"
              description="Te ayudo a buscar familiares, registrar desaparecidos, ver necesidades activas o guiarte para ofrecer ayuda."
            >
              <div className="grid sm:grid-cols-2 gap-2 mt-4 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm px-3 py-2.5 rounded-lg border border-input hover:border-[color:var(--sunrise)] hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent
                className={m.role === "assistant" ? "bg-transparent p-0 shadow-none" : undefined}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <span key={i} className="whitespace-pre-wrap">
                        {part.text}
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
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={`tool-${toolName}`} state={state as never} />
                        <ToolContent>
                          <ToolInput input={p.input} />
                          {(p.output !== undefined || p.errorText) && (
                            <ToolOutput output={renderToolOutput(toolName, p.output)} errorText={p.errorText} />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent className="bg-transparent p-0 shadow-none">
                <Shimmer>Tsunami está pensando…</Shimmer>
              </MessageContent>
            </Message>
          )}

          {error && (
            <div className="text-sm text-destructive px-2 py-1">⚠️ {error.message}</div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div className="border-t bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto w-full p-3">
          <PromptInput
            onSubmit={(msg) => {
              send(msg.text ?? "");
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a Tsunami…"
              autoFocus
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={busy || !input.trim()} />
            </PromptInputFooter>
          </PromptInput>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Tsunami está en pruebas. Si necesitas ayuda urgente visita{" "}
            <Link to="/" className="underline">
              venezuelaselevanta.info
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

// Render a friendlier card for known tool outputs.
function renderToolOutput(toolName: string, output: unknown): React.ReactNode {
  if (!output || typeof output !== "object") {
    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>;
  }
  const o = output as Record<string, unknown>;

  if (toolName === "search_missing_persons" && Array.isArray(o.results)) {
    const results = o.results as Array<Record<string, unknown>>;
    if (results.length === 0) return <p className="text-sm text-muted-foreground">Sin resultados.</p>;
    return (
      <div className="space-y-2">
        {results.map((r) => (
          <a
            key={String(r.id)}
            href={String(r.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded-lg border hover:border-[color:var(--sunrise)] hover:bg-accent transition-colors"
          >
            {r.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(r.photo_url)}
                alt=""
                className="h-12 w-12 rounded object-cover bg-muted"
              />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xl">🧑</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{String(r.name)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[r.age && `${r.age} años`, r.state, r.municipality].filter(Boolean).join(" · ")}
              </div>
            </div>
            <span className="text-xs text-[color:var(--sunrise)] font-semibold">Ver ficha →</span>
          </a>
        ))}
      </div>
    );
  }

  if (toolName === "list_needs" && Array.isArray(o.results)) {
    const results = o.results as Array<Record<string, unknown>>;
    if (results.length === 0)
      return <p className="text-sm text-muted-foreground">No hay necesidades abiertas.</p>;
    return (
      <div className="space-y-2">
        {results.map((r) => (
          <a
            key={String(r.id)}
            href={String(r.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 rounded-lg border hover:border-[color:var(--sunrise)] hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground">{String(r.category)}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                {String(r.urgency)}
              </span>
            </div>
            <div className="font-semibold text-sm">{String(r.title)}</div>
            <div className="text-xs text-muted-foreground">{String(r.center_name ?? "")}</div>
          </a>
        ))}
      </div>
    );
  }

  return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>;
}
