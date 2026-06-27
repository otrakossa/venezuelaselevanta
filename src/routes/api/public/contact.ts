import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Venezuela Se Levanta'
const SENDER_DOMAIN = 'notify.venezuelaselevanta.info'
const FROM_DOMAIN = 'notify.venezuelaselevanta.info'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().max(150).optional().nullable(),
  message: z.string().trim().min(5).max(2000),
})

// In-memory rate limit: 5 messages/IP/hour
const LIMIT = 5
const WINDOW_MS = 60 * 60 * 1000
const ipMap = new Map<string, { count: number; resetAt: number }>()
function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
function limited(ip: string): boolean {
  const now = Date.now()
  const entry = ipMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= LIMIT) return true
  entry.count++
  return false
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const Route = createFileRoute('/api/public/contact')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const ip = getIp(request)
        if (limited(ip)) {
          return Response.json(
            { error: 'Demasiados mensajes. Intenta en una hora.' },
            { status: 429, headers: CORS },
          )
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS })
        }

        const parsed = schema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: 'Datos inválidos', details: parsed.error.flatten() },
            { status: 400, headers: CORS },
          )
        }
        const data = parsed.data

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEW_SUPABASE_URL
        const serviceKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEW_SUPABASE_SERVICE_KEY
        if (!supabaseUrl || !serviceKey) {
          console.error('Missing Supabase server env')
          return Response.json(
            { error: 'Configuración del servidor incompleta' },
            { status: 500, headers: CORS },
          )
        }
        const supabase = createClient(supabaseUrl, serviceKey)

        // 1. Store the message
        const { error: insertErr } = await supabase.from('contact_messages').insert({
          name: data.name,
          email: data.email,
          subject: data.subject || null,
          message: data.message,
        })
        if (insertErr) {
          console.error('contact_messages insert failed', insertErr)
          return Response.json(
            { error: 'No se pudo guardar el mensaje' },
            { status: 500, headers: CORS },
          )
        }

        // 2. Send notification email — non-blocking from the user's perspective.
        try {
          await sendContactNotification(supabase, data)
        } catch (err) {
          console.error('contact notification email failed', err)
          // Still return success — the message is stored.
        }

        return Response.json({ success: true }, { headers: CORS })
      },
    },
  },
})

async function sendContactNotification(
  supabase: ReturnType<typeof createClient>,
  data: { name: string; email: string; subject?: string | null; message: string },
) {
  const template = TEMPLATES['contact-notification']
  if (!template?.to) return

  const recipient = template.to.toLowerCase()
  const messageId = crypto.randomUUID()
  const templateData = {
    name: data.name,
    email: data.email,
    subject: data.subject || '(sin asunto)',
    message: data.message,
    receivedAt: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
  }

  // Suppression check
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipient)
    .maybeSingle()
  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'contact-notification',
      recipient_email: recipient,
      status: 'suppressed',
    })
    return
  }

  // Unsubscribe token (reuse-or-create)
  let unsubscribeToken: string
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', recipient)
    .maybeSingle()

  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token as string
  } else {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: recipient },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', recipient)
      .maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token as string
  }

  // Render
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // Log pending
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'contact-notification',
    recipient_email: recipient,
    status: 'pending',
  })

  // Enqueue
  const { error: enqueueErr } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: 'contact-notification',
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueErr) {
    console.error('enqueue_email failed', enqueueErr)
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'contact-notification',
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
  }
}
