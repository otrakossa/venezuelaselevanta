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

// Rich inline "fichas" shown directly inside the chat for each tool result.
function renderToolOutput(toolName: string, output: unknown): React.ReactNode {
  if (!output || typeof output !== "object") {
    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>;
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
          <MissingFicha key={String(r.id)} data={r} compact />
        ))}
      </div>
    );
  }

  if (toolName === "get_missing_person" && o.id) {
    return <MissingFicha data={o} />;
  }

  if (toolName === "suggest_patient_matches" && Array.isArray(o.matches)) {
    const matches = o.matches as Array<Record<string, unknown>>;
    if (matches.length === 0)
      return <p className="text-sm text-muted-foreground">Sin coincidencias en centros de salud.</p>;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {matches.length} posible{matches.length === 1 ? "" : "s"} coincidencia
          {matches.length === 1 ? "" : "s"} — revisa cada ficha:
        </p>
        {matches.map((m, i) => (
          <div
            key={String(m.patient_id ?? i)}
            className="p-3 rounded-lg border bg-card space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">🏥 {String(m.patient_name ?? "Sin nombre")}</div>
              {typeof m.score === "number" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                  {Math.round(Number(m.score) * 100)}%
                </span>
              )}
            </div>
            {Boolean(m.center_name) && (
              <div className="text-xs text-muted-foreground">📍 {String(m.center_name)}</div>
            )}
            {Boolean(m.reason) && (
              <div className="text-xs text-muted-foreground italic">{String(m.reason)}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (toolName === "register_missing_person") {
    if (o.status === "pending_confirmation" && o.preview) {
      const p = o.preview as Record<string, unknown>;
      return (
        <div className="p-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 space-y-1">
          <div className="text-xs font-bold text-amber-900 uppercase">
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
          <div className="text-xs text-green-900/80">Ya quedó guardado en la plataforma. Sigamos por aquí si necesitas algo más. 🐾</div>
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
          <NeedFicha key={String(r.id)} data={r} compact />
        ))}
      </div>
    );
  }

  if (toolName === "get_need" && o.id) {
    return <NeedFicha data={o} />;
  }

  if (toolName === "guide_offer_help" && Array.isArray(o.steps)) {
    const steps = o.steps as string[];
    return (
      <div className="space-y-2">
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


  return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>;
}

function MissingFicha({ data, compact = false }: { data: Record<string, unknown>; compact?: boolean }) {
  const url = data.url ? String(data.url) : undefined;
  const photo = data.photo_url ? String(data.photo_url) : null;
  const status = data.status ? String(data.status) : null;
  const statusColor =
    status === "found"
      ? "bg-green-100 text-green-900"
      : status === "deceased"
        ? "bg-gray-200 text-gray-900"
        : "bg-amber-100 text-amber-900";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex gap-3 p-3">
        {photo ? (
          <img
            src={photo}
            alt=""
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
        </div>
      </div>
    </div>
  );
}

function NeedFicha({ data, compact = false }: { data: Record<string, unknown>; compact?: boolean }) {
  const offerUrl = data.offer_url ? String(data.offer_url) : data.url ? String(data.url) : undefined;
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
      {offerUrl && (
        <a
          href={offerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-2 text-xs font-semibold text-white bg-[color:var(--sunrise)] hover:opacity-90 text-center"
        >
          Ofrecer ayuda →
        </a>
      )}
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

