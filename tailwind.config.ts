import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bt: {
          bg: '#060a12',
          surface: '#0d1320',
          border: '#1a2236',
          primary: '#1a8fe3',
          accent: '#2ec4a5',
          text: '#e6ebf2',
          muted: '#8a94a8'
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
