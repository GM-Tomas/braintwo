# BrainTwo

BrainTwo is a local desktop memory layer for your WhatsApp self-chat. It pairs as a linked device, stores messages in SQLite, imports full `.txt` exports, builds local embeddings, and lets you search your timeline semantically.

## Features

- WhatsApp linked-device onboarding with QR, reconnect, tray, autostart, and hide-on-close.
- Realtime, offline catch-up, history-sync, and `.txt` export ingest with deterministic deduplication.
- Timeline filters for text, audio, image, video, document, sticker, and imported messages.
- Local semantic search backed by `sqlite-vec` and a serialized embedding queue.
- Settings page for DB stats, user-data folder, export reimport, autostart, and logout.
- Sync status badge, catch-up notifications, stale-primary warning, and user-facing main-process errors.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

On Windows PowerShell with script execution disabled, run the `.cmd` shims instead:

```bash
npm.cmd run typecheck
npm.cmd test
```

## Semantic Search Model

BrainTwo is wired for `Xenova/multilingual-e5-small` via `@xenova/transformers` and caches model files under the app user-data folder in `models/`. If the transformer package or model is unavailable, the app falls back to a deterministic local vectorizer so search, tests, and offline development still work.

The model is not packaged into the installer; it downloads on first use when the transformer runtime is available.

## Importing WhatsApp History

WhatsApp linked devices only provide recent history. To load older messages:

1. Open the chat with yourself in WhatsApp.
2. Choose export chat.
3. Select no media.
4. Import the generated `.txt` from BrainTwo onboarding or Settings.

Repeated imports are safe because export message IDs are deterministic.

## Packaging

```bash
npm run package
```

`electron-builder.yml` targets Windows NSIS, macOS DMG, and Linux AppImage. Native dependencies are rebuilt by the install/build scripts.

## Troubleshooting

- If `better-sqlite3` ABI errors appear after changing Electron or Node, remove `.abi` and rerun the dev/test command.
- If linked devices log out, open WhatsApp on the primary phone. WhatsApp can revoke linked devices after long primary-phone inactivity.
- If the first semantic search is slow, the model may be downloading into the user-data cache.
