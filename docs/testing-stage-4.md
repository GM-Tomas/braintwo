# Etapa 4 — Captura realtime + offline catch-up + tests

## Suite automática

```bash
npm test               # 235 tests
npm run test:coverage  # con threshold 80% global
```

### Coverage actual

| Archivo | %Stmts | %Branch | %Funcs | %Lines |
|---|---|---|---|---|
| **All files** | **99.89** | **95.77** | **94.18** | **99.89** |
| electron/main-helpers.ts | 100 | 100 | 100 | 100 |
| electron/preload-api.ts | 100 | 100 | 100 | 100 |
| electron/services/db.ts | 100 | 88.46 | 100 | 100 |
| electron/services/ingest.ts | 100 | 100 | 100 | 100 |
| electron/services/whatsapp-state.ts | 100 | 100 | 100 | 100 |
| electron/services/whatsapp.ts | 99.52 | 87.83 | 80 | 99.52 |
| src/App.tsx | 100 | 100 | 100 | 100 |
| src/views/Onboarding.tsx | 100 | 100 | 100 | 100 |
| src/views/Timeline.tsx | 100 | 96.42 | 100 | 100 |
| scripts/generate-icons-lib.mjs | 100 | 100 | 100 | 100 |

## Casos clave

### Pipeline de ingesta ([ingest.ts](../electron/services/ingest.ts))

29 tests cubren:
- `extractText` reconoce **todas** las variantes de Baileys: `conversation`, `extendedTextMessage.text`, `imageMessage.caption`, `videoMessage.caption`, `documentMessage.caption`, `documentWithCaptionMessage`, **y desempaqueta `ephemeralMessage` + `viewOnceMessage`** correctamente.
- `extractTimestampMs` maneja números planos (segundos × 1000) y objetos Long (`{ low }`), con fallback a `Date.now()` si falta.
- Pipeline skipea sin `wa_msg_id` (`'no-id'`), sin texto/caption (`'no-text'`), y devuelve `'duplicate'` para `wa_msg_id` repetido.
- Logger pino estructurado: cada ingesta exitosa loguea `{ wa_msg_id, source, timestamp, text_preview }` con preview truncado a 80 chars.
- `recent(limit)` ordena por timestamp DESC y respeta limit (incluyendo `<=0`).
- `count()` no cuenta duplicados (consistente con `INSERT OR IGNORE`).

### Filtrado de chat conmigo mismo ([whatsapp-state.ts](../electron/services/whatsapp-state.ts))

`isSelfChat(remoteJid, myJid)` + `normalizeJid` testeados con 9 casos: el sufijo `:N` del linked device de Baileys (`549...:42@s.whatsapp.net`) se compara correctamente contra el JID base del chat conmigo mismo (`549...@s.whatsapp.net`); rechaza grupos (`@g.us`) y otros usuarios.

### Handlers de mensajes ([whatsapp.ts](../electron/services/whatsapp.ts))

12 tests nuevos:
- `messages.upsert` con `type='notify'` → emite `{ raw, source: 'realtime' }`.
- `messages.upsert` con `type='append'` → emite `source: 'offline-sync'` (catch-up offline — **el bug clásico que el BRIEF advierte**).
- Filtra mensajes que no sean del chat conmigo mismo.
- No emite cuando `sock.user.id` aún no está seteado.
- `messaging-history.set` → emite `source: 'history-sync'`.
- Tolera `messages` ausente.

### Throttled batcher ([main-helpers.ts](../electron/main-helpers.ts))

6 tests sobre `createMessageBatcher`:
- Coalesce: 3 pushes en un mismo tick → un único `broadcast([1,2,3])`.
- Schedule per-tick: el siguiente push después de la flush programa una nueva flush.
- `flush()` manual fuerza drain inmediato.
- Solo programa **una vez** mientras hay pendientes (no flood).
- Default scheduler (`setImmediate`) drena correctamente.

Esto cumple lo del BRIEF: "IPC throttled (un evento batched por tick si entran muchos mensajes juntos)" — durante un history sync con cientos de mensajes, solo cruzamos el bridge IPC una vez.

### Timeline UI ([Timeline.tsx](../src/views/Timeline.tsx))

11 tests sobre el view + `mergeRecent`:
- Renderiza count + lista al montar.
- Pluralización: "1 mensaje" / "N mensajes".
- Empty state cuando no hay mensajes.
- Una batch nueva se prependa, dedupea por id, y bumpea el counter.
- Una batch vacía no bumpea.
- Renderiza badges por `MessageSource` con tono según tipo.
- `mergeRecent` (pure): batch+prev se ordenan por timestamp DESC, dedupean por id, truncan a `limit`.
- Cleanup de la suscripción `onMessagesBatch` en unmount.
- Tolera batch llegando post-unmount sin warning de React.

## Performance preservada (BRIEF)

| Optimización | Cómo |
|---|---|
| Filtrado en main, no en renderer | `isSelfChat` filtra antes del `emit('message')` |
| Dedup en SQL (`INSERT OR IGNORE`) | `db.insertMessage` usa el statement preparado |
| IPC throttled | `createMessageBatcher` con `setImmediate` |
| Tipos de `messages.upsert` | Ambos `notify` y `append` procesados (no descarte silencioso) |
| `getMessage` defined | (Etapa 3, mantiene retries de cifrado) |

## Pasos de aceptación manual

```bash
npm run dev
```

- Vincular WhatsApp escaneando QR (Etapa 3).
- Mandarse un mensaje al "yo a yo" desde el celular.
- **Esperado**: aparece en menos de 5s en la vista Timeline con badge "Tiempo real" y contador en +1.
- Apagar la PC, mandarse 3 mensajes desde el cel, prenderla de nuevo.
- **Esperado**: tras la reconexión, los 3 mensajes aparecen con badge "Catch-up" (source `offline-sync`).
- Cerrar y reabrir la app: NO se duplican (dedup por `wa_msg_id`).

## Trampas conocidas / pendientes

- **better-sqlite3 + Electron ABI**: en este entorno `npm run dev` no requirió `electron-builder install-app-deps`. Si en otra máquina sale `Error: NODE_MODULE_VERSION mismatch`, agregar a `package.json`:
  ```json
  "scripts": { "rebuild:electron": "electron-builder install-app-deps" }
  ```
  y correr una vez antes de `npm run dev`. Tests requieren ABI Node, no Electron — por eso no lo metimos en postinstall.
- **Deduplicación cross-device**: vec0 (Etapa 5) tendrá los embeddings; el `ingest` ya valida que no insertemos duplicados aunque el celular reenvíe el mismo `wa_msg_id` por múltiples canales (history-sync + realtime).
- **Batcher flush en quit**: `before-quit` llama `messageBatcher?.flush()` para drenar pendientes antes de cerrar la DB. Si la app crashea, el batch en vuelo se pierde — aceptable porque vienen de `messages.upsert` y se reentregan en el próximo connect.
