import { useState } from "react";
import { z } from "zod";
import { Mail, Send, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().min(5, "Mensaje muy corto").max(2000),
});

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mountedAt] = useState(() => Date.now());


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          subject: parsed.data.subject || null,
          message: parsed.data.message,
          website: form.website,
          elapsed_ms: Date.now() - mountedAt,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        toast.error(body?.error || "No se pudo enviar. Intenta de nuevo en unos segundos.");
        return;
      }
    } catch {
      setLoading(false);
      toast.error("Error de red. Intenta de nuevo.");
      return;
    }
    setLoading(false);
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "", website: "" });
    toast.success("¡Mensaje enviado! Te responderemos pronto.");
  }


  if (sent) {
    return (
      <div className="rounded-2xl border border-[color:var(--sunrise)]/30 bg-gradient-to-br from-[color:var(--cream)] to-[color:var(--gold)]/10 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-[color:var(--sunrise)]" />
        <h3 className="font-display text-2xl mt-3 text-[color:var(--midnight)]">¡Gracias!</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Tu mensaje fue recibido. Lo revisaremos y te contactaremos lo antes posible.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--sunrise)] hover:underline"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 text-[color:var(--midnight)]">
        <Mail className="h-5 w-5 text-[color:var(--sunrise)]" />
        <h3 className="font-display text-xl">Escríbenos</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        ¿Quieres colaborar, sumar tu organización o reportar algo? Llena el formulario.
      </p>

      {/* Honeypot: hidden field, real users won't fill it. Bots often do. */}
      <div aria-hidden="true" className="hidden" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          No llenar este campo
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </label>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nombre" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sunrise)]/40"
            placeholder="Tu nombre"
            required
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            maxLength={255}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sunrise)]/40"
            placeholder="tu@correo.com"
            required
          />
        </Field>
      </div>

      <Field label="Asunto (opcional)" error={errors.subject}>
        <input
          type="text"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          maxLength={150}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sunrise)]/40"
          placeholder="Colaboración, alianza, prensa..."
        />
      </Field>

      <Field label="Mensaje" error={errors.message}>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          maxLength={2000}
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sunrise)]/40 resize-none"
          placeholder="Cuéntanos en qué quieres colaborar o cómo podemos ayudarte."
          required
        />
        <div className="text-[10px] text-muted-foreground text-right mt-1">
          {form.message.length}/2000
        </div>
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-5 py-2.5 text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {loading ? "Enviando..." : "Enviar mensaje"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[color:var(--midnight)] block mb-1">{label}</span>
      {children}
      {error && <span className="text-[11px] text-red-600 mt-1 block">{error}</span>}
    </label>
  );
}
