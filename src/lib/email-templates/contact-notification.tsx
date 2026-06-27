import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  subject?: string
  message?: string
  receivedAt?: string
}

const ContactNotificationEmail = ({
  name = 'Anónimo',
  email = 'desconocido@—',
  subject = '(sin asunto)',
  message = '',
  receivedAt,
}: Props) => {
  const when =
    receivedAt ?? new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Nuevo mensaje de ${name}: ${subject}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>📩 Nuevo mensaje de contacto</Heading>
          <Text style={meta}>Venezuela Se Levanta · {when}</Text>

          <Section style={card}>
            <Text style={label}>De</Text>
            <Text style={value}>
              {name} &lt;{email}&gt;
            </Text>

            <Hr style={hr} />

            <Text style={label}>Asunto</Text>
            <Text style={value}>{subject}</Text>

            <Hr style={hr} />

            <Text style={label}>Mensaje</Text>
            <Text style={messageBody}>{message}</Text>
          </Section>

          <Text style={footer}>
            Respóndele directamente a <strong>{email}</strong> para continuar la
            conversación.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ContactNotificationEmail,
  subject: (data: Record<string, unknown>) =>
    `[Venezuela Se Levanta] ${(data?.subject as string) || 'Nuevo mensaje de contacto'}`,
  displayName: 'Notificación de contacto',
  previewData: {
    name: 'María Pérez',
    email: 'maria@example.com',
    subject: 'Quiero colaborar',
    message: 'Hola, mi organización quiere sumarse a la red de ayuda.',
  },
  to: 'kenny@codextecnologia.com',
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: 'Hind, Arial, sans-serif',
  color: '#0D2B45',
}
const container: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '32px 24px',
}
const h1: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: '0 0 4px',
  color: '#0D2B45',
}
const meta: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  margin: '0 0 20px',
}
const card: React.CSSProperties = {
  border: '1px solid #FFE0CC',
  borderRadius: 12,
  padding: '18px 20px',
  backgroundColor: '#FFF8F1',
}
const label: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#FF6B35',
  fontWeight: 700,
  margin: '0 0 4px',
}
const value: React.CSSProperties = {
  fontSize: 15,
  margin: '0 0 6px',
  color: '#0D2B45',
}
const messageBody: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.55,
  margin: '0',
  whiteSpace: 'pre-wrap',
  color: '#0D2B45',
}
const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #FFE0CC',
  margin: '12px 0',
}
const footer: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginTop: 18,
}
