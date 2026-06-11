#!/usr/bin/env node
// Rebuilds better-sqlite3 against Electron's NODE_MODULE_VERSION.
// Skips when a marker file says we're already built for that ABI.
// Pair with rebuild-for-node.mjs for round-tripping between dev and tests.
import { rebuild } from '@electron/rebuild'
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'node:fs'
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
  const electronPkg = JSON.parse(
    readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf-8')
  )
  await rebuild({
    buildPath: root,
    electronVersion: electronPkg.version,
    force: true,
    onlyModules: ['better-sqlite3']
  })
  writeFileSync(ELECTRON_MARKER, new Date().toISOString())
  try {
    unlinkSync(NODE_MARKER)
  } catch {
    /* missing marker is fine */
  }
  console.log('[rebuild] Done — marker .abi/electron.marker written.')
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (/EPERM|EBUSY/i.test(msg) || /operation not permitted/i.test(msg)) {
    console.error('')
    console.error('[rebuild] ✗ Native module is locked.')
    console.error(
      '[rebuild]   Looks like an Electron dev process is still running.'
    )
    console.error(
      '[rebuild]   Close it (tray → Salir, or kill the dev terminal) and re-run.'
    )
    console.error('')
  } else {
    console.error('[rebuild] electron-rebuild failed:', msg)
  }
  process.exit(1)
}
