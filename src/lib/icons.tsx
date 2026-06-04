// Inline icon set lifted from the Claude Design BrainTwo prototype.
// Stroked, currentColor-aware, sized via the `size` prop. Keeping them
// inline (no external dep) lets us match the prototype byte-for-byte
// and avoids shipping an icon-font.

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
  'aria-hidden'?: boolean
}

export type IconName =
  | 'home'
  | 'search'
  | 'folder'
  | 'archive'
  | 'settings'
  | 'plus'
  | 'mic'
  | 'bolt'
  | 'wa'
  | 'play'
  | 'pause'
  | 'chev'
  | 'tag'
  | 'logout'
  | 'check'
  | 'x'
  | 'image'
  | 'video'
  | 'file'
  | 'sticker'
  | 'help'
  | 'chat'
  | 'panel-left-close'
  | 'panel-left-open'
  | 'sun'
  | 'moon'
  | 'send'

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.6,
  'aria-hidden': ariaHidden = true
}: IconProps) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={ariaHidden}
    >
      {renderPath(name, stroke)}
    </svg>
  )
}

function renderPath(
  name: IconName,
  s: {
    fill: string
    stroke: string
    strokeWidth: number
    strokeLinecap: 'round'
    strokeLinejoin: 'round'
  }
): JSX.Element | null {
  switch (name) {
    case 'home':
      return (
        <path
          d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"
          {...s}
        />
      )
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="7" {...s} />
          <line x1="21" y1="21" x2="16.65" y2="16.65" {...s} />
        </>
      )
    case 'folder':
      return (
        <path
          d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          {...s}
        />
      )
    case 'archive':
      return (
        <>
          <rect x="3" y="4" width="18" height="4" rx="1" {...s} />
          <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" {...s} />
          <line x1="10" y1="13" x2="14" y2="13" {...s} />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" {...s} />
          <path
            d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
            {...s}
          />
        </>
      )
    case 'plus':
      return (
        <>
          <line x1="12" y1="5" x2="12" y2="19" {...s} />
          <line x1="5" y1="12" x2="19" y2="12" {...s} />
        </>
      )
    case 'mic':
      return (
        <>
          <rect x="9" y="2" width="6" height="11" rx="3" {...s} />
          <path d="M5 10a7 7 0 0014 0" {...s} />
          <line x1="12" y1="20" x2="12" y2="23" {...s} />
        </>
      )
    case 'bolt':
      return (
        <path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" {...s} />
      )
    case 'wa':
      return (
        <path
          d="M17.47 14.38c-.26-.13-1.53-.75-1.77-.84-.24-.09-.41-.13-.58.13-.17.26-.66.84-.81 1.01-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.1-1.28-.78-.69-1.3-1.54-1.45-1.8-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44l-.49-.01c-.17 0-.44.06-.67.32-.23.26-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.53-.63 1.74-1.23.22-.6.22-1.12.15-1.23-.06-.1-.23-.16-.49-.29zM12 2a10 10 0 00-8.7 14.9L2 22l5.25-1.38A10 10 0 1012 2z"
          fill="currentColor"
          stroke="none"
        />
      )
    case 'play':
      return <polygon points="5 3 19 12 5 21 5 3" {...s} />
    case 'pause':
      return (
        <>
          <line x1="6" y1="4" x2="6" y2="20" {...s} />
          <line x1="18" y1="4" x2="18" y2="20" {...s} />
        </>
      )
    case 'chev':
      return <polyline points="9 18 15 12 9 6" {...s} />
    case 'tag':
      return (
        <>
          <path
            d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"
            {...s}
          />
          <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
        </>
      )
    case 'logout':
      return (
        <>
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" {...s} />
          <polyline points="16 17 21 12 16 7" {...s} />
          <line x1="21" y1="12" x2="9" y2="12" {...s} />
        </>
      )
    case 'check':
      return <polyline points="5 12 10 17 20 7" {...s} />
    case 'x':
      return (
        <>
          <line x1="6" y1="6" x2="18" y2="18" {...s} />
          <line x1="6" y1="18" x2="18" y2="6" {...s} />
        </>
      )
    case 'image':
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" {...s} />
          <circle cx="8.5" cy="8.5" r="1.5" {...s} />
          <polyline points="21 15 16 10 5 21" {...s} />
        </>
      )
    case 'video':
      return (
        <>
          <rect x="2" y="6" width="14" height="12" rx="2" {...s} />
          <polygon points="16 9 22 6 22 18 16 15" {...s} />
        </>
      )
    case 'file':
      return (
        <>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" {...s} />
          <polyline points="14 2 14 8 20 8" {...s} />
        </>
      )
    case 'sticker':
      return (
        <>
          <path d="M15 3H5a2 2 0 00-2 2v14a2 2 0 002 2h10l6-6V5a2 2 0 00-2-2z" {...s} />
          <path d="M15 21V15a2 2 0 012-2h4" {...s} />
        </>
      )
    case 'help':
      return (
        <>
          <circle cx="12" cy="12" r="10" {...s} />
          <path d="M9.1 9a3 3 0 015.83 1c0 2-3 3-3 3" {...s} />
          <line x1="12" y1="17" x2="12.01" y2="17" {...s} />
        </>
      )
    case 'chat':
      return (
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" {...s} />
      )
    case 'panel-left-close':
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" {...s} />
          <line x1="9" y1="3" x2="9" y2="21" {...s} />
          <path d="M16 15l-3-3 3-3" {...s} />
        </>
      )
    case 'panel-left-open':
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" {...s} />
          <line x1="9" y1="3" x2="9" y2="21" {...s} />
          <path d="M14 9l3 3-3 3" {...s} />
        </>
      )
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="5" {...s} />
          <line x1="12" y1="1" x2="12" y2="3" {...s} />
          <line x1="12" y1="21" x2="12" y2="23" {...s} />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" {...s} />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" {...s} />
          <line x1="1" y1="12" x2="3" y2="12" {...s} />
          <line x1="21" y1="12" x2="23" y2="12" {...s} />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" {...s} />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" {...s} />
        </>
      )
    case 'moon':
      return (
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...s} />
      )
    case 'send':
      return (
        <>
          <line x1="22" y1="2" x2="11" y2="13" {...s} />
          <polygon points="22 2 15 22 11 13 2 9 22 2" {...s} />
        </>
      )
    default:
      return null
  }
}

interface BrainMarkProps {
  size?: number
  className?: string
}

export function BrainMark({ size = 28, className }: BrainMarkProps) {
  // Each render generates a unique gradient id so the icon can appear
  // multiple times on a page (e.g. tray + sidebar) without colliding.
  const id = `bm-${size}-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--bt-primary)" />
          <stop offset="100%" stopColor="var(--bt-accent)" />
        </linearGradient>
      </defs>
      <g
        stroke={`url(#${id})`}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M48 18 C36 18,24 26,20 38 C18 44,18 50,20 54 C18 58,20 66,26 70 C30 80,40 86,49 84 L48 18Z" />
        <path d="M52 18 C64 18,76 26,80 38 C82 44,82 50,80 54 C82 58,80 66,74 70 C70 80,60 86,51 84 L52 18Z" />
        <line x1="50" y1="18" x2="50" y2="84" strokeOpacity="0.25" />
      </g>
      <circle cx="32" cy="40" r="3" fill={`url(#${id})`} />
      <circle cx="68" cy="40" r="3" fill={`url(#${id})`} />
      <circle cx="50" cy="52" r="4.5" fill={`url(#${id})`} />
      <circle cx="38" cy="64" r="2.5" fill={`url(#${id})`} />
      <circle cx="62" cy="64" r="2.5" fill={`url(#${id})`} />
    </svg>
  )
}
