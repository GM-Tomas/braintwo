import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { ImportProgress, WAConnectionState } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon, BrainMark, type IconName } from '@/lib/icons'

const FTU_KEY = 'braintwo:ftu-seen'

function setFtuFlag(value: boolean) {
  try {
    if (value) localStorage.setItem(FTU_KEY, '1')
    else localStorage.removeItem(FTU_KEY)
  } catch { /* ignore */ }
}

// ── FTU carousel ─────────────────────────────────────────────────────────────

interface FTUSplash { kind: 'splash' }
interface FTUFeature { kind: 'feature'; icon: IconName; title: string; body: string }
interface FTUQr { kind: 'qr' }
type FTUStepDef = FTUSplash | FTUFeature | FTUQr

const FTU_STEPS: FTUStepDef[] = [
  { kind: 'splash' },
  {
    kind: 'feature',
    icon: 'search',
    title: 'BUSCÁ EN TU HISTORIAL',
    body: 'Encontrá cualquier conversación, audio o link que mandaste o recibiste, sin scrollear meses de chats.',
  },
  {
    kind: 'feature',
    icon: 'home',
    title: 'TU TIMELINE PERSONAL',
    body: 'Tu actividad de WhatsApp ordenada cronológicamente — un feed de lo que importa, sin algoritmo.',
  },
  { kind: 'qr' },
]

export function FTU({
  startAtQr = false,
  theme = 'dark',
  toggleTheme = () => {}
}: {
  startAtQr?: boolean
  theme?: 'light' | 'dark'
  toggleTheme?: () => void
}) {
  const [step, setStep] = useState(() => (startAtQr ? FTU_STEPS.length - 1 : 0))
  const [waState, setWaState] = useState<WAConnectionState>('connecting')
  const [qr, setQr] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    void window.braintwo.wa.getConnectionState().then(setWaState)
    void window.braintwo.wa.getCurrentQr().then(setQr)
    const offState = window.braintwo.wa.onConnectionState(setWaState)
    const offQr = window.braintwo.wa.onQr(setQr)
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
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [qr])

  const current = FTU_STEPS[step]
  const isLast = step === FTU_STEPS.length - 1

  function advance() {
    const next = step + 1
    if (next === FTU_STEPS.length - 1) setFtuFlag(true)
    setStep(next)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        key={step}
        className="flex flex-1 flex-col items-center justify-center px-8 py-10 animate-fade-in"
      >
        <div className="flex w-full max-w-[360px] flex-col items-center">
          {current.kind === 'splash' && <FTUSplashCard />}
          {current.kind === 'feature' && <FTUFeatureCard step={current} />}
          {current.kind === 'qr' && <FTUQrCard waState={waState} qrDataUrl={qrDataUrl} />}
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 pb-10">
        <div className="flex items-center gap-2">
          {FTU_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-[6px] rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-bt-accent' : 'w-[6px] bg-bt-border-strong'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            title={theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-bt-border text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={advance}
              className="rounded-[10px] px-8 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FTUSplashCard() {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <BrainMark size={80} />
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-display text-[64px] leading-none tracking-wider text-bt-text">
          BRAINTWO
        </h1>
        <p className="text-[11px] uppercase tracking-eyebrow text-bt-dim">
          Tu segundo cerebro
        </p>
      </div>
    </div>
  )
}

function FTUFeatureCard({ step }: { step: FTUFeature }) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-bt-border-strong"
        style={{ background: 'linear-gradient(135deg,var(--bt-primary-faint),var(--bt-accent-faint))' }}
        aria-hidden
      >
        <Icon name={step.icon} size={34} className="text-bt-accent" strokeWidth={1.4} />
      </div>
      <div className="flex flex-col items-center gap-4">
        <h2 className="font-display text-[44px] leading-tight tracking-tight text-bt-text">
          {step.title}
        </h2>
        <p className="max-w-[280px] text-[15px] leading-relaxed text-bt-muted">{step.body}</p>
      </div>
    </div>
  )
}

function FTUQrCard({
  waState,
  qrDataUrl,
}: {
  waState: WAConnectionState
  qrDataUrl: string | null
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h2 className="font-display text-[40px] leading-tight tracking-tight text-bt-text">
          VINCULÁ TU WHATSAPP
        </h2>
        <p className="max-w-[240px] text-[13px] leading-relaxed text-bt-muted">
          Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo
        </p>
      </div>

      <div className="flex h-[264px] w-[264px] items-center justify-center overflow-hidden rounded-[16px] border border-bt-border-strong bg-bt-surf">
        {waState === 'logged-out' ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <Icon name="wa" size={28} className="text-bt-red" />
            <p className="text-sm text-bt-muted">La sesión se cerró desde el celular.</p>
            <button
              type="button"
              onClick={() => void window.braintwo.wa.requestQr()}
              className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
            >
              Generar QR de nuevo
            </button>
          </div>
        ) : qrDataUrl ? (
          <img src={qrDataUrl} alt="QR para vincular WhatsApp" width={248} height={248} />
        ) : waState === 'disconnected' ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="h-2 w-2 rounded-full bg-bt-muted" />
            <p className="text-sm text-bt-muted">No se pudo conectar con WhatsApp.</p>
            <button
              type="button"
              onClick={() => void window.braintwo.wa.requestQr()}
              className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-sm text-bt-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-bt-primary" />
            Generando QR…
          </div>
        )}
      </div>
    </div>
  )
}

// ── Onboarding (sidebar view for already-connected users) ────────────────────

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
      color: { dark: '#0f172a', light: '#ffffff' }
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
            style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
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
            style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
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

  if (state === 'disconnected') {
    return (
      <Card>
        <div className="flex h-[280px] w-full flex-col items-center justify-center gap-4 px-6 text-center text-sm text-bt-muted">
          <p>No se pudo conectar con WhatsApp.</p>
          <button
            type="button"
            className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
            onClick={() => void window.braintwo.wa.requestQr()}
          >
            Reintentar
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex h-[280px] w-full flex-col items-center justify-center gap-3 text-sm text-bt-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-bt-primary" />
        Generando QR…
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
        style={{ background: 'linear-gradient(135deg,var(--bt-primary-faint),var(--bt-accent-faint))' }}
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
