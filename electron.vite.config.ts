import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve('electron/main.ts'), formats: ['es'] },
      rollupOptions: {
        output: { entryFileNames: '[name].mjs' }
      }
    },
    resolve: {
      alias: { '@shared': resolve('shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve('electron/preload.ts'), formats: ['es'] },
      rollupOptions: {
        output: { entryFileNames: '[name].mjs' }
      }
    },
    resolve: {
      alias: { '@shared': resolve('shared') }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: { index: resolve('index.html') }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src'),
        '@shared': resolve('shared')
      }
    }
  }
})
