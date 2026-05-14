#!/usr/bin/env node
// Launches electron-vite with ELECTRON_RUN_AS_NODE removed from the environment.
// The shell may have ELECTRON_RUN_AS_NODE=1 set globally, which makes Electron's
// binary behave as plain Node and breaks main-process startup. cross-env can only
// set vars to empty strings, not delete them, so we spawn from a clean Node wrapper.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

delete process.env.ELECTRON_RUN_AS_NODE

const __dirname = dirname(fileURLToPath(import.meta.url))
const cli = join(__dirname, '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
