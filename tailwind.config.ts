import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bt: {
          // Backgrounds
          bg: '#060a12',
          surf: '#0c1422',
          hover: '#101d2e',
          // Surface / borders
          border: 'rgba(255,255,255,0.06)',
          'border-strong': 'rgba(255,255,255,0.12)',
          faint: 'rgba(255,255,255,0.04)',
          // Text
          text: '#e8eef8',
          muted: '#7a92b0',
          dim: '#4a5d75',
          // Brand
          primary: '#1a8fe3',
          accent: '#2ec4a5',
          amber: '#e8b84e',
          red: '#e85d5d'
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
        'bt-grad': 'linear-gradient(135deg, #1a8fe3, #2ec4a5)'
      },
      boxShadow: {
        'bt-modal': '0 30px 80px rgba(0,0,0,0.5)',
        'bt-glow-teal': '0 0 8px #2ec4a5',
        'bt-glow-blue': '0 0 8px #1a8fe3'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' }
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.22,1,0.36,1) both'
      }
    }
  },
  plugins: []
} satisfies Config
