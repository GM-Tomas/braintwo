import type { MessageKind, MessageSource } from '@shared/types'
import type { IconName } from '@/lib/icons'

export const SOURCE_LABEL: Record<MessageSource, string> = {
  realtime: 'Tiempo real',
  'offline-sync': 'Sincronización diferida',
  'history-sync': 'Histórico',
  export: 'Importado'
}

export const SOURCE_DOT: Record<MessageSource, string> = {
  realtime: 'bg-bt-accent',
  'offline-sync': 'bg-bt-amber',
  'history-sync': 'bg-bt-primary',
  export: 'bg-bt-red'
}

export interface KindStyle {
  icon: IconName
  label: string
  iconColor: string
  bg: string
  border: string
}

export const KIND_STYLE: Record<MessageKind, KindStyle> = {
  text: {
    icon: 'bolt',
    label: 'Texto',
    iconColor: 'text-bt-primary',
    bg: 'rgba(26,143,227,0.08)',
    border: 'rgba(26,143,227,0.20)'
  },
  audio: {
    icon: 'mic',
    label: 'Audio',
    iconColor: 'text-bt-amber',
    bg: 'rgba(232,184,78,0.10)',
    border: 'rgba(232,184,78,0.25)'
  },
  image: {
    icon: 'image',
    label: 'Imagen',
    iconColor: 'text-bt-accent',
    bg: 'rgba(46,196,165,0.10)',
    border: 'rgba(46,196,165,0.25)'
  },
  video: {
    icon: 'video',
    label: 'Video',
    iconColor: 'text-bt-red',
    bg: 'rgba(232,93,93,0.10)',
    border: 'rgba(232,93,93,0.25)'
  },
  document: {
    icon: 'file',
    label: 'Documento',
    iconColor: 'text-bt-text',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)'
  },
  sticker: {
    icon: 'sticker',
    label: 'Sticker',
    iconColor: 'text-bt-accent',
    bg: 'rgba(46,196,165,0.08)',
    border: 'rgba(46,196,165,0.18)'
  },
  other: {
    icon: 'help',
    label: 'Otro',
    iconColor: 'text-bt-muted',
    bg: 'rgba(122,146,176,0.08)',
    border: 'rgba(122,146,176,0.18)'
  }
}
