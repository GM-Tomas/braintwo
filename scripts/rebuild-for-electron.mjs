#!/usr/bin/env node
// Rebuilds better-sqlite3 against Electron's NODE_MODULE_VERSION.
// Skips when a marker file says we're already built for that ABI.
// Pair with rebuild-for-node.mjs for round-tripping between dev and tests.
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

if (existsSync(ELECTRON_MARKER)) {
  console.log('[rebuild] better-sqlite3 already built for Electron ABI — skipping.')
  process.exit(0)
}

console.log('[rebuild] Rebuilding better-sqlite3 against Electron ABI…')
try {
  execSync('npx electron-rebuild -f -w better-sqlite3', {
    stdio: 'inherit',
    cwd: root
  })
  writeFileSync(ELECTRON_MARKER, new Date().toISOString())
  try {
    unlinkSync(NODE_MARKER)
  } catch {
    /* missing marker is fine */
  }
  console.log('[rebuild] Done — marker .abi/electron.marker written.')
} catch (err) {
  console.error('[rebuild] electron-rebuild failed:', err)
  process.exit(1)
}
