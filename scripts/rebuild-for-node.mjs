#!/usr/bin/env node
// Rebuilds better-sqlite3 against the system Node's NODE_MODULE_VERSION
// (so vitest can load it). Skips when a marker file says we're already
// built for Node ABI.
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
  console.error('[rebuild] npm rebuild failed:', err)
  process.exit(1)
}
