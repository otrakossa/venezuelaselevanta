import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export type WizardStep = {
  key: string;
  label: string;
  content: ReactNode;
  isValid?: () => boolean;
  invalidMessage?: string;
};

type Props = {
  title: string;
  steps: WizardStep[];
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
};

export function Wizard({
  title,
  steps,
  submitLabel = "Enviar",
  submitting = false,
  onSubmit,
  onCancel,
}: Props) {
  const [current, setCurrent] = useState(0);
  const total = steps.length;
  const step = steps[current];
  const isLast = current === total - 1;
  const isFirst = current === 0;

  const goNext = () => {
    if (step.isValid && !step.isValid()) {
      toast.error(step.invalidMessage || "Completa los campos requeridos");
      return;
    }
    setCurrent((c) => Math.min(c + 1, total - 1));
  };
  const goBack = () => setCurrent((c) => Math.max(c - 1, 0));

  const handleSubmit = async () => {
    if (step.isValid && !step.isValid()) {
      toast.error(step.invalidMessage || "Completa los campos requeridos");
      return;
    }
    await onSubmit();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 mb-4 shadow-sm max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base sm:text-lg font-bold text-[color:var(--midnight)]">{title}</h2>
          <span className="text-[11px] font-semibold text-[color:var(--sunrise)] bg-[color:var(--sunrise)]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
            Paso {current + 1} de {total}
          </span>
        </div>
        <div
          className="flex gap-1.5 mb-2"
          role="progressbar"
          aria-valuenow={current + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= current ? "bg-[color:var(--sunrise)]" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-medium">{step.label}</p>
      </div>

      {/* Content */}
      <div className="space-y-3">{step.content}</div>

      {/* Footer */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 justify-between items-stretch sm:items-center pt-5 mt-5 border-t border-border">
        <div className="flex gap-2">
          {!isFirst ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted disabled:opacity-50 min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
          ) : (
            onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="inline-flex items-center justify-center px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted disabled:opacity-50 min-h-[44px]"
              >
                Cancelar
              </button>
            )
          )}
        </div>

        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-[color:var(--sunrise)] text-white font-bold disabled:opacity-50 shadow-md shadow-[color:var(--sunrise)]/20 min-h-[44px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> {submitLabel}
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm rounded-xl bg-[color:var(--sunrise)] text-white font-bold shadow-md shadow-[color:var(--sunrise)]/20 min-h-[44px]"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
