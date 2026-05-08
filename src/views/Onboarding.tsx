import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { WAConnectionState } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '@/lib/icons'

export function Onboarding() {
  const [state, setState] = useState<WAConnectionState>('connecting')
  const [qr, setQr] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    void window.braintwo.wa.getConnectionState().then((s) => setState(s))
    void window.braintwo.wa.getCurrentQr().then((q) => setQr(q))
    const offState = window.braintwo.wa.onConnectionState((s) => setState(s))
    const offQr = window.braintwo.wa.onQr((q) => setQr(q))
    const offLoggedOut = window.braintwo.wa.onLoggedOut(() => {
      setQr(null)
      setQrDataUrl(null)
    })
    return () => {
      offState()
      offQr()
      offLoggedOut()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!qr) {
      setQrDataUrl(null)
      return
    }
    void QRCode.toDataURL(qr, {
      width: 280,
      margin: 1,
      color: { dark: '#060a12', light: '#e8eef8' }
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [qr])

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Onboarding"
        title="Vinculá tu WhatsApp"
        subtitle="BrainTwo se conecta como dispositivo vinculado a tu cuenta. Tus mensajes se procesan localmente — nunca salen de tu computadora."
      />

      <div className="flex flex-1 overflow-y-auto px-14 py-10">
        <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-[300px_1fr] md:items-start">
          <PairingPanel state={state} qrDataUrl={qrDataUrl} />
          <div className="flex flex-col gap-6">
            <Steps state={state} hasQr={!!qrDataUrl} />
            <SuccessNote state={state} />
          </div>
        </div>
      </div>
    </div>
  )
}

interface PanelProps {
  state: WAConnectionState
  qrDataUrl: string | null
}

function PairingPanel({ state, qrDataUrl }: PanelProps) {
  if (state === 'open') {
    return (
      <Card>
        <div className="flex h-[280px] w-full flex-col items-center justify-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg,#1a8fe3,#2ec4a5)' }}
          >
            <Icon name="check" size={32} strokeWidth={2.5} className="text-white" />
          </div>
          <span className="text-3xl text-bt-accent" aria-hidden>
            ✓
          </span>
        </div>
      </Card>
    )
  }

  if (state === 'logged-out') {
    return (
      <Card>
        <div className="flex h-[280px] w-full flex-col items-center justify-center gap-4 px-6 text-center text-sm text-bt-muted">
          <Icon name="wa" size={32} className="text-bt-red" />
          <p>La sesión se cerró desde el celular.</p>
          <button
            type="button"
            className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#1a8fe3,#2ec4a5)' }}
            onClick={() => void window.braintwo.wa.requestQr()}
          >
            Generar QR de nuevo
          </button>
        </div>
      </Card>
    )
  }

  if (qrDataUrl) {
    return (
      <Card padded={false}>
        <div className="flex h-[300px] w-full items-center justify-center bg-bt-bg p-2">
          <img
            src={qrDataUrl}
            alt="QR para vincular WhatsApp"
            width={280}
            height={280}
            className="rounded-md"
          />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex h-[280px] w-full flex-col items-center justify-center gap-3 text-sm text-bt-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-bt-primary" />
        {state === 'connecting' ? 'Generando QR…' : 'Reconectando…'}
      </div>
    </Card>
  )
}

function Card({
  children,
  padded = true
}: {
  children: React.ReactNode
  padded?: boolean
}) {
  return (
    <div
      className={`overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf ${
        padded ? 'p-2' : ''
      }`}
    >
      {children}
    </div>
  )
}

function Steps({ state, hasQr }: { state: WAConnectionState; hasQr: boolean }) {
  if (state === 'open' || state === 'logged-out') return null
  return (
    <section>
      <div className="mb-3 text-[11px] uppercase tracking-eyebrow text-bt-dim">
        Cómo vincular
      </div>
      <ol className="space-y-3 text-sm leading-relaxed text-bt-muted">
        <Step n={1}>
          Abrí WhatsApp en tu celular → Configuración → Dispositivos vinculados.
        </Step>
        <Step n={2}>
          Tocá <em className="not-italic text-bt-text">Vincular un dispositivo</em>.
        </Step>
        <Step n={3}>
          {hasQr
            ? 'Escaneá el código de la izquierda con la cámara del celular.'
            : 'Esperá a que aparezca el código acá.'}
        </Step>
      </ol>
    </section>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-bt-border text-[11px] font-semibold text-bt-text"
        style={{ background: 'linear-gradient(135deg,#1a8fe320,#2ec4a520)' }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function SuccessNote({ state }: { state: WAConnectionState }) {
  if (state !== 'open') return null
  return (
    <p className="rounded-[14px] border border-bt-border bg-bt-surf px-5 py-4 text-sm leading-relaxed text-bt-accent">
      ✓ Vinculado. Ya podés cerrar este panel y empezar a buscar.
    </p>
  )
}
