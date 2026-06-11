import { useRef, useState } from 'react'
import { MessageEntity } from '@shared/domain/message.entity'
import { Icon } from '@/lib/icons'
import { formatBytes, formatDuration } from '@/lib/format'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { KIND_STYLE, SOURCE_LABEL } from './timeline-constants'

const MEDIA_KEY_LABEL: Record<string, string> = {
  fileLengthBytes: 'Tamaño del archivo',
  durationSec: 'Duración',
  mimetype: 'Tipo MIME',
  fileName: 'Nombre de archivo',
  ptt: 'Nota de voz',
  height: 'Alto',
  width: 'Ancho',
  pageCount: 'Páginas'
}

interface MessageDetailProps {
  message: MessageEntity
  onClose: () => void
  onToggleIgnore?: (msgId: number) => void
}

export function MessageDetail({ message, onClose, onToggleIgnore }: MessageDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const style = KIND_STYLE[message.kind] ?? KIND_STYLE.other
  const isIgnored = !!message.ignored

  const longFormatter = useDateFormatter({ dateStyle: 'long', timeStyle: 'short' })

  const rows = [
    { label: 'ID SQLite', value: message.id },
    { label: 'WhatsApp ID', value: <code className="break-all font-mono text-[11px]">{message.waMsgId}</code> },
    {
      label: 'Marca de tiempo',
      value: (
        <span>
          {longFormatter.format(new Date(message.timestamp))}
          <span className="ml-2 text-bt-dim text-[11px]">({message.timestamp})</span>
        </span>
      )
    },
    ...(message.createdAt != null
      ? [
          {
            label: 'Insertado en BD',
            value: (
              <span>
                {longFormatter.format(new Date(message.createdAt))}
                <span className="ml-2 text-bt-dim text-[11px]">
                  ({Math.floor(message.createdAt / 1000)})
                </span>
              </span>
            )
          }
        ]
      : []),
    { label: 'Tipo', value: <span className={`capitalize ${style.iconColor}`}>{message.kind}</span> },
    { label: 'Fuente', value: SOURCE_LABEL[message.source] }
  ]

  return (
    <div
      ref={panelRef}
      className="flex flex-1 flex-col overflow-hidden bg-bt-bg animate-fade-in"
      aria-label="Detalle del mensaje"
    >
      {/* Header */}
      <div className="relative z-20 flex items-center gap-4 border-b border-bt-border px-8 py-5">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
          aria-label="Volver"
        >
          <Icon name="chev" size={16} className="rotate-180" />
        </button>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: style.bg, border: `1px solid ${style.border}` }}
        >
          <Icon name={style.icon} size={15} className={style.iconColor} />
        </div>
        <div className="flex-1">
          <h2 className="text-[16px] font-semibold text-bt-text">Detalle del mensaje</h2>
          <p className="text-[13px] text-bt-dim capitalize">{style.label}</p>
        </div>
        {onToggleIgnore && (
          <button
            type="button"
            onClick={() => onToggleIgnore(message.id)}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all ${
              isIgnored
                ? 'border-bt-amber/30 text-bt-amber bg-bt-amber/[0.06]'
                : 'border-bt-border/60 text-bt-muted hover:border-bt-amber/20 hover:text-bt-amber'
            }`}
            title={isIgnored ? 'Incluir en contexto IA' : 'Excluir del contexto IA'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {isIgnored ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
            <span>{isIgnored ? 'Incluir' : 'Ignorar'}</span>
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-[720px] space-y-6">
          {/* Text content */}
          {message.text ? (
            <section>
              <SectionLabel>Contenido</SectionLabel>
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-bt-border bg-bt-hover px-4 py-3.5 text-[14px] leading-relaxed text-bt-text">
                {message.text}
              </p>
            </section>
          ) : null}

          {/* Context note — generated by AI for semantic search enrichment */}
          <section>
            <SectionLabel>Contexto para búsqueda</SectionLabel>
            {message.contextNote ? (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-bt-primary/20 bg-bt-primary/[0.06] px-4 py-3.5 text-[14px] leading-relaxed text-bt-text">
                {message.contextNote}
              </p>
            ) : (
              <p className="mt-2 rounded-lg border border-bt-border bg-bt-hover px-4 py-3.5 text-[13px] text-bt-dim italic">
                Pendiente — se genera en background cuando hay IA configurada
              </p>
            )}
          </section>

          {/* All SQLite fields — collapsible */}
          <CollapsibleSection label="Información adicional">
            <dl className="mt-2 divide-y divide-bt-border rounded-lg border border-bt-border bg-bt-surf overflow-hidden">
              {rows.map(({ label, value }) => (
                <div key={label} className="grid grid-cols-3 gap-4 px-4 py-3">
                  <dt className="text-[12px] font-medium text-bt-dim">{label}</dt>
                  <dd className="col-span-2 text-[13px] text-bt-text break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </CollapsibleSection>

          {/* Media metadata */}
          {message.media ? (
            <section>
              <SectionLabel>Metadatos de archivo</SectionLabel>
              <dl className="mt-2 divide-y divide-bt-border rounded-lg border border-bt-border bg-bt-surf overflow-hidden">
                {Object.entries(message.media)
                  .filter(([, v]) => v != null)
                  .map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-4 px-4 py-3">
                      <dt className="text-[12px] font-medium text-bt-dim">{MEDIA_KEY_LABEL[key] ?? key}</dt>
                      <dd className="col-span-2 text-[13px] text-bt-text break-words">
                        {typeof value === 'boolean'
                          ? value ? 'Sí' : 'No'
                          : key === 'fileLengthBytes'
                          ? formatBytes(value as number)
                          : key === 'durationSec'
                          ? formatDuration(value as number)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold uppercase tracking-widest text-bt-dim">
      {children}
    </p>
  )
}

function CollapsibleSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-bt-border bg-bt-surf/30 hover:bg-bt-surf px-3 py-1.5 text-[12.5px] text-bt-muted hover:text-bt-text transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-bt-primary/40 cursor-pointer"
      >
        <span>{open ? `Ocultar ${label.toLowerCase()}` : `Ver ${label.toLowerCase()}`}</span>
        <Icon
          name="chev"
          size={12}
          className={`text-bt-dim transition-transform duration-150 ${open ? 'rotate-90' : '0'}`}
        />
      </button>
      {open && <div className="w-full mt-2">{children}</div>}
    </section>
  )
}
