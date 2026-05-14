#!/usr/bin/env node
// Rebuilds better-sqlite3 against the system Node's NODE_MODULE_VERSION
// (so vitest can load it). Skips when a marker file says we're already
// built for Node ABI. Detects Windows EPERM (Electron still running)
// and prints actionable guidance instead of a node-gyp wall of text.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const markersDir = join(root, '.abi')
mkdirSync(markersDir, { recursive: true })

const ELECTRON_MARKER = join(markersDir, 'electron.marker')
const NODE_MARKER = join(markersDir, 'node.marker')

if (existsSync(NODE_MARKER)) {
  console.log('[rebuild] better-sqlite3 already built for Node ABI — skipping.')
  process.exit(0)
}

console.log('[rebuild] Rebuilding better-sqlite3 against Node ABI…')
try {
  execSync('npm rebuild better-sqlite3 --force', {
    stdio: 'inherit',
    cwd: root
  })
  writeFileSync(NODE_MARKER, new Date().toISOString())
  try {
    unlinkSync(ELECTRON_MARKER)
  } catch {
    /* missing marker is fine */
  }
  console.log('[rebuild] Done — marker .abi/node.marker written.')
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (/EPERM|EBUSY/i.test(msg) || /operation not permitted/i.test(msg)) {
    console.error('')
    console.error('[rebuild] ✗ Native module is locked.')
    console.error(
      '[rebuild]   Looks like an Electron dev process (npm run dev) is still running.'
    )
    console.error(
      '[rebuild]   Close it (tray icon → Salir, or kill the dev terminal) and re-run.'
    )
    console.error('')
  } else {
    console.error('[rebuild] npm rebuild failed:', msg)
  }
  process.exit(1)
}
