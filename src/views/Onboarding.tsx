import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { WAConnectionState } from '@shared/types'
import { Icon, BrainMark, type IconName } from '@/lib/icons'

const FTU_KEY = 'braintwo:ftu-seen'
// Baileys closes the socket briefly after a successful QR scan before
// reconnecting and reaching 'open'. While the new socket comes up, the WA
// state passes through 'disconnected' — which used to surface the failure UI
// even though pairing was actually succeeding.
const POST_SCAN_GRACE_MS = 30_000

// True while the QR has been dismissed (most likely scanned) but the
// connection has not yet reached a terminal state. Use this to render a
// "Conectando…" spinner instead of the misleading "no se pudo conectar"
// error during the post-scan reconnect window.
function usePairingInFlight(qr: string | null, state: WAConnectionState): boolean {
  const [inFlight, setInFlight] = useState(false)
  const prevQrRef = useRef<string | null>(null)

  useEffect(() => {
    const hadQr = prevQrRef.current !== null
    prevQrRef.current = qr
    if (hadQr && qr === null && state !== 'open' && state !== 'logged-out') {
      setInFlight(true)
    }
  }, [qr, state])

  useEffect(() => {
    if (state === 'open' || state === 'logged-out') setInFlight(false)
  }, [state])

  useEffect(() => {
    if (!inFlight) return
    const t = setTimeout(() => setInFlight(false), POST_SCAN_GRACE_MS)
    return () => clearTimeout(t)
  }, [inFlight])

  return inFlight
}

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
  const [timeLeft, setTimeLeft] = useState(60)
  const pairingInFlight = usePairingInFlight(qr, waState)

  useEffect(() => {
    void window.braintwo.wa.getConnectionState().then(setWaState)
    void window.braintwo.wa.getCurrentQr().then(setQr)
    const offState = window.braintwo.wa.onConnectionState(setWaState)
    const offQr = window.braintwo.wa.onQr((newQr) => {
      setQr(newQr)
      setTimeLeft(60)
    })
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
    if (!qr || waState === 'open') return
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [qr, waState])

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
          {current.kind === 'qr' && (
            <FTUQrCard
              waState={waState}
              qrDataUrl={qrDataUrl}
              timeLeft={timeLeft}
              pairingInFlight={pairingInFlight}
              onReload={() => {
                setQr(null)
                setQrDataUrl(null)
                void window.braintwo.wa.requestQr()
              }}
            />
          )}
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
  timeLeft,
  pairingInFlight,
  onReload,
}: {
  waState: WAConnectionState
  qrDataUrl: string | null
  timeLeft: number
  pairingInFlight: boolean
  onReload: () => void
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

      <div className="group relative flex h-[264px] w-[264px] items-center justify-center overflow-hidden rounded-[16px] border border-bt-border-strong bg-bt-surf">
        {waState === 'logged-out' ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <Icon name="wa" size={28} className="text-bt-red" />
            <p className="text-sm text-bt-muted">La sesión se cerró desde el celular.</p>
            <button
              type="button"
              onClick={onReload}
              className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
            >
              Generar QR de nuevo
            </button>
          </div>
        ) : qrDataUrl ? (
          <>
            <img src={qrDataUrl} alt="QR para vincular WhatsApp" width={248} height={248} />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bt-surf/80 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={onReload}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-bt-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                title="Recargar QR"
              >
                <Icon name="refresh" size={24} />
              </button>
              <p className="mt-2 text-xs font-medium text-bt-text">Recargar QR</p>
            </div>
            <div className="absolute bottom-2 right-2 rounded-full bg-bt-bg/80 px-2 py-0.5 text-[10px] font-mono text-bt-muted backdrop-blur-sm">
              Expira en {timeLeft}s
            </div>
          </>
        ) : pairingInFlight ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-sm text-bt-muted">
            <span
              aria-hidden
              className="h-6 w-6 animate-spin rounded-full border-2 border-bt-border border-t-bt-primary"
            />
            Conectando…
          </div>
        ) : waState === 'disconnected' ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="h-2 w-2 rounded-full bg-bt-muted" />
            <p className="text-sm text-bt-muted">No se pudo conectar con WhatsApp.</p>
            <button
              type="button"
              onClick={onReload}
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

