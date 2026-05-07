import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { WAConnectionState } from '@shared/types'

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
      color: { dark: '#060a12', light: '#ffffff' }
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [qr])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 pt-10 text-center">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Vinculá tu WhatsApp</h2>
        <p className="text-sm text-bt-muted">
          BrainTwo se conecta como dispositivo vinculado a tu cuenta. Tus
          mensajes se procesan localmente — nunca salen de tu computadora.
        </p>
      </header>

      <PairingPanel state={state} qrDataUrl={qrDataUrl} />

      <Steps state={state} hasQr={!!qrDataUrl} />

      {state === 'open' ? (
        <p className="text-sm text-bt-accent">
          ✓ Vinculado. Ya podés cerrar este panel y empezar a buscar.
        </p>
      ) : null}
    </div>
  )
}

function PairingPanel({
  state,
  qrDataUrl
}: {
  state: WAConnectionState
  qrDataUrl: string | null
}) {
  const baseClasses =
    'flex h-[300px] w-[300px] items-center justify-center rounded-lg border border-bt-border bg-bt-surface'

  if (state === 'open') {
    return (
      <div className={baseClasses}>
        <span className="text-4xl text-bt-accent">✓</span>
      </div>
    )
  }

  if (state === 'logged-out') {
    return (
      <div className={`${baseClasses} flex-col gap-3 px-6 text-sm text-bt-muted`}>
        <p>La sesión se cerró desde el celular.</p>
        <button
          className="rounded-md bg-bt-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          onClick={() => void window.braintwo.wa.requestQr()}
        >
          Generar QR de nuevo
        </button>
      </div>
    )
  }

  if (qrDataUrl) {
    return (
      <div className={baseClasses}>
        <img src={qrDataUrl} alt="QR para vincular WhatsApp" width={280} height={280} />
      </div>
    )
  }

  return (
    <div className={`${baseClasses} flex-col gap-3 text-sm text-bt-muted`}>
      <span className="h-2 w-2 animate-pulse rounded-full bg-bt-primary" />
      {state === 'connecting' ? 'Generando QR…' : 'Reconectando…'}
    </div>
  )
}

function Steps({
  state,
  hasQr
}: {
  state: WAConnectionState
  hasQr: boolean
}) {
  if (state === 'open' || state === 'logged-out') return null
  return (
    <ol className="space-y-2 text-left text-sm text-bt-muted">
      <li>
        <span className="mr-2 text-bt-primary">1.</span>
        Abrí WhatsApp en tu celular → Configuración → Dispositivos vinculados.
      </li>
      <li>
        <span className="mr-2 text-bt-primary">2.</span>
        Tocá <em>Vincular un dispositivo</em>.
      </li>
      <li>
        <span className="mr-2 text-bt-primary">3.</span>
        {hasQr
          ? 'Escaneá el código de la izquierda con la cámara del celular.'
          : 'Esperá a que aparezca el código acá.'}
      </li>
    </ol>
  )
}
