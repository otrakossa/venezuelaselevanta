import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'already' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken(t)
    if (!t) {
      setState({ kind: 'invalid' })
      return
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          setState({ kind: 'invalid' })
          return
        }
        if (body.reason === 'already_unsubscribed') {
          setState({ kind: 'already' })
          return
        }
        if (body.valid) {
          setState({ kind: 'ready' })
          return
        }
        setState({ kind: 'invalid' })
      })
      .catch(() => setState({ kind: 'invalid' }))
  }, [])

  async function confirm() {
    setState({ kind: 'submitting' })
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        setState({ kind: 'error', message: body?.error ?? 'No se pudo procesar.' })
        return
      }
      if (body.reason === 'already_unsubscribed') {
        setState({ kind: 'already' })
        return
      }
      setState({ kind: 'done' })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-display text-2xl text-[color:var(--midnight)]">
          Cancelar suscripción
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Venezuela Se Levanta
        </p>

        <div className="mt-6">
          {state.kind === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando enlace…
            </div>
          )}

          {state.kind === 'invalid' && (
            <div className="text-sm">
              <XCircle className="h-10 w-10 mx-auto text-red-500" />
              <p className="mt-3 text-red-600 font-medium">Enlace inválido o expirado.</p>
            </div>
          )}

          {state.kind === 'already' && (
            <div className="text-sm">
              <CheckCircle2 className="h-10 w-10 mx-auto text-[color:var(--sunrise)]" />
              <p className="mt-3">
                Ya estás dado de baja. No recibirás más correos nuestros.
              </p>
            </div>
          )}

          {state.kind === 'ready' && (
            <>
              <p className="text-sm text-muted-foreground">
                ¿Confirmas que quieres dejar de recibir correos de Venezuela Se Levanta?
              </p>
              <button
                onClick={confirm}
                className="mt-5 inline-flex items-center justify-center bg-[color:var(--sunrise)] text-white font-semibold rounded-full px-5 py-2.5 text-sm hover:opacity-90 shadow-md"
              >
                Sí, cancelar suscripción
              </button>
            </>
          )}

          {state.kind === 'submitting' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
            </div>
          )}

          {state.kind === 'done' && (
            <div className="text-sm">
              <CheckCircle2 className="h-10 w-10 mx-auto text-[color:var(--sunrise)]" />
              <p className="mt-3">Listo. No te enviaremos más correos.</p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="text-sm">
              <XCircle className="h-10 w-10 mx-auto text-red-500" />
              <p className="mt-3 text-red-600">{state.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  head: () => ({
    meta: [{ title: 'Cancelar suscripción · Venezuela Se Levanta' }],
  }),
})
