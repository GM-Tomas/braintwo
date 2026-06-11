import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bt: {
          // Backgrounds
          bg: 'var(--bt-bg)',
          surf: 'var(--bt-surf)',
          hover: 'var(--bt-hover)',
          'sidebar-bg': 'var(--bt-sidebar-bg)',
          // Surface / borders
          border: 'var(--bt-border)',
          'border-strong': 'var(--bt-border-strong)',
          faint: 'var(--bt-faint)',
          // Text
          text: 'var(--bt-text)',
          muted: 'var(--bt-muted)',
          dim: 'var(--bt-dim)',
          // Brand
          primary: 'var(--bt-primary)',
          'primary-faint': 'var(--bt-primary-faint)',
          accent: 'var(--bt-accent)',
          'accent-faint': 'var(--bt-accent-faint)',
          amber: 'var(--bt-amber)',
          red: 'var(--bt-red)',
          'send-btn': 'var(--bt-send-btn-bg)',
          'send-btn-hover': 'var(--bt-send-btn-bg-hover)',
          brand: 'var(--bt-brand)'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Bebas Neue"', 'Outfit', 'sans-serif']
      },
      letterSpacing: {
        eyebrow: '0.22em',
        ribbon: '0.18em'
      },
      backgroundImage: {
        'bt-grad': 'linear-gradient(135deg, var(--bt-primary), var(--bt-accent))'
      },
      boxShadow: {
        'bt-modal': 'var(--bt-shadow-modal)',
        'bt-glow-teal': '0 0 8px var(--bt-accent)',
        'bt-glow-blue': '0 0 8px var(--bt-primary)',
        'bt-nav-active': 'var(--bt-nav-active-shadow)'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' }
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' }
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in': 'slideIn 0.4s cubic-bezier(0.22,1,0.36,1) both'
      }
    }
  },
  plugins: []
} satisfies Config
