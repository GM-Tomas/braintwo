import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { ImportProgress, WAConnectionState } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon, BrainMark, type IconName } from '@/lib/icons'

interface WelcomeCardsProps {
  onContinue: () => void
}

interface FeatureCard {
  icon: IconName
  title: string
  body: string
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: 'search',
    title: 'Buscá en tu historial',
    body: 'Encontrá cualquier conversación, audio o link que mandaste o recibiste, sin scrollear meses de chats.'
  },
  {
    icon: 'home',
    title: 'Timeline propio',
    body: 'Tu actividad de WhatsApp ordenada cronológicamente — un feed de lo que importa, no de lo que el algoritmo elige.'
  },
  {
    icon: 'bolt',
    title: '100% local y privado',
    body: 'Todo se procesa en tu computadora. Tus mensajes nunca salen a la nube ni a servidores externos.'
  },
  {
    icon: 'wa',
    title: 'Vinculación oficial',
    body: 'Se conecta como un dispositivo vinculado de WhatsApp, igual que WhatsApp Web. No reemplaza tu app.'
  }
]

export function WelcomeCards({ onContinue }: WelcomeCardsProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <header className="flex flex-col items-center gap-4 px-14 pt-14 pb-6 text-center">
        <div className="p-2" aria-hidden>
          <BrainMark size={44} />
        </div>
        <div className="text-[11px] uppercase tracking-eyebrow text-bt-dim">
          Bienvenido a BrainTwo
        </div>
        <h1 className="font-display text-[44px] leading-tight tracking-tight text-bt-text">
          Tu segundo cerebro de WhatsApp
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-bt-muted">
          Una capa local sobre tus chats que te deja buscar, recordar y revivir lo que pasó —
          sin enviar nada a la nube.
        </p>
      </header>

      <div className="flex flex-1 overflow-y-auto px-14 pb-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURE_CARDS.map((card) => (
              <article
                key={card.title}
                className="flex flex-col gap-3 rounded-[14px] border border-bt-border bg-bt-surf p-5"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                  style={{ background: 'linear-gradient(135deg,#1a8fe320,#2ec4a520)' }}
                  aria-hidden
                >
                  <Icon name={card.icon} size={20} className="text-bt-text" />
                </div>
                <h2 className="text-[15px] font-semibold text-bt-text">{card.title}</h2>
                <p className="text-sm leading-relaxed text-bt-muted">{card.body}</p>
              </article>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="rounded-[10px] px-6 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#1a8fe3,#2ec4a5)' }}
            >
              Continuar
            </button>
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">
              Próximo paso · Vincular WhatsApp
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Onboarding() {
  const [state, setState] = useState<WAConnectionState>('connecting')
  const [qr, setQr] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)

  useEffect(() => {
    void window.braintwo.wa.getConnectionState().then((s) => setState(s))
    void window.braintwo.wa.getCurrentQr().then((q) => setQr(q))
    const offState = window.braintwo.wa.onConnectionState((s) => setState(s))
    const offQr = window.braintwo.wa.onQr((q) => setQr(q))
    const offLoggedOut = window.braintwo.wa.onLoggedOut(() => {
      setQr(null)
      setQrDataUrl(null)
    })
    const offProgress = window.braintwo.export.onProgress((progress) => {
      setImportProgress(progress)
    })
    return () => {
      offState()
      offQr()
      offLoggedOut()
      offProgress()
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
            <ImportHistoryPanel progress={importProgress} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ImportHistoryPanel({ progress }: { progress: ImportProgress | null }) {
  const [busy, setBusy] = useState(false)
  const pct = progress && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0

  return (
    <section className="rounded-[14px] border border-bt-border bg-bt-surf px-5 py-4">
      <div className="mb-3 text-[11px] uppercase tracking-eyebrow text-bt-dim">
        Historico completo
      </div>
      <ol className="space-y-2 text-sm leading-relaxed text-bt-muted">
        <li>1. En WhatsApp abri el chat con vos mismo.</li>
        <li>2. Usa Exportar chat y elegi sin medios.</li>
        <li>3. Importa el .txt para sumar mensajes viejos.</li>
      </ol>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void window.braintwo.export.importTxt().finally(() => setBusy(false))
        }}
        className="mt-4 h-9 rounded-[8px] border border-bt-primary/30 px-4 text-[13px] font-semibold text-bt-text transition-colors hover:bg-bt-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Importando...' : 'Importar historico'}
      </button>
      {progress ? (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-bt-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-bt-dim">
            {progress.done
              ? `${progress.inserted} importados, ${progress.skipped} duplicados`
              : `${progress.processed}/${progress.total} mensajes`}
          </p>
        </div>
      ) : null}
    </section>
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
