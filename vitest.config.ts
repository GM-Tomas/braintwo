import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve('shared'),
      '@': resolve('src')
    }
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['__tests__/src/**/*', 'jsdom'],
      ['**/*.tsx', 'jsdom']
    ],
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '__tests__/**/*.test.{ts,tsx,mjs}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: [
        'electron/services/**/*.ts',
        'electron/preload-api.ts',
        'electron/main-helpers.ts',
        'src/App.tsx',
        'src/views/**/*.tsx',
        'src/components/**/*.tsx',
        'src/lib/**/*.ts',
        'src/lib/**/*.tsx',
        'scripts/generate-icons-lib.mjs'
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/main.tsx'
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80
      }
    }
  }
})
