#!/usr/bin/env node
// Runner: writes BrainTwo icons to build/. Pure logic lives in
// generate-icons-lib.mjs so it can be unit-tested.
import { writeFileSync, mkdirSync } from 'node:fs'
import { createPng, brainTwoIcon } from './generate-icons-lib.mjs'

mkdirSync('build', { recursive: true })

const sizes = {
  'tray-icon.png': 16,
  'tray-icon@2x.png': 32,
  'tray-icon@3x.png': 48,
  'icon-256.png': 256,
  'icon-512.png': 512
}

for (const [name, size] of Object.entries(sizes)) {
  const png = createPng(size, brainTwoIcon)
  writeFileSync(`build/${name}`, png)
  console.log(`build/${name} (${size}x${size}) — ${png.length} bytes`)
}
