# BrainTwo — Etapas de desarrollo (back + front)

> Complemento operativo de [BRIEF.md](BRIEF.md). El BRIEF tiene la arquitectura, las decisiones y las trampas. Este documento divide la implementación en etapas con tracks **Backend** y **Frontend** explícitos por etapa, preservando todas las optimizaciones de performance del BRIEF.

---

## Etapa 0 — Reset estructural y bootstrap

**Por qué existe:** el repo actual tiene `frontend/` con Next.js + restos de otro proyecto (`backend/application/useCases/InstallBot.js`, `main.js`, etc.) que no corresponden al stack del BRIEF. Antes de empezar hay que alinear el árbol con la estructura objetivo.

**Backend / harness**
- Mover/archivar `frontend/`, `frontend_old/`, `backend/`, `main.js`, `preload.js` actuales a `archive/` o borrar.
- `npm init`, TS strict + ESM, `electron`, `electron-vite`, `electron-builder`.
- Estructura objetivo: `electron/`, `src/`, `shared/`.
- `tsconfig.json`, `electron.vite.config.ts`, `electron-builder.yml`, `.gitignore` (excluyendo `userData/`, `dist/`, `out/`, `node_modules/`).

**Frontend**
- React + Tailwind configurado en `src/`.
- Routing mínimo (state machine: `onboarding | search | timeline`).
- Theme dark base (`#060a12` / `#1a8fe3` / `#2ec4a5`).

**Aceptación:** `npm run dev` levanta Electron + React, hot reload de ambos lados funciona, no quedan archivos del proyecto previo en el árbol activo.

---

## Etapa 1 — Shell de SO: tray, autostart, single instance

**Backend**
- `electron/main.ts`: `requestSingleInstanceLock`, `setLoginItemSettings({ openAtLogin, openAsHidden })`, tray con menú (Abrir / Estado / Salir), `window-all-closed` con `preventDefault` salvo `app.isQuitting`.
- `electron/preload.ts` con `contextBridge` (vacío, listo para canales futuros).
- IPC `app:open-window`, `app:quit`.

**Frontend**
- `App.tsx` con layout base + header reservado para el badge de sync.
- Vista placeholder "Iniciando…".

**Performance:** ventana se **oculta** al tray (no se destruye) → reabrir es instantáneo, no rehidratamos React de cero.

**Aceptación:** cerrar ventana oculta al tray; reabrir desde tray es <100ms; reiniciar SO → app aparece en tray sola; segunda instancia se cierra.

---

## Etapa 2 — Capa de datos: SQLite + sqlite-vec

**Backend**
- `electron/services/db.ts`: `better-sqlite3` con `journal_mode = WAL`, `synchronous = NORMAL`, `temp_store = MEMORY`, `mmap_size`.
- Carga de extensión `sqlite-vec`.
- Migrations idempotentes (esquema `messages` + `vec0` 384 dims + índice `idx_msg_ts`).
- `scripts/test-db.ts` para verificar dedup e insert/query KNN dummy.
- Statements **preparados y reutilizados** (no recompilar por mensaje).

**Frontend**
- Sin cambios visibles. (Etapa puramente de fundación.)

**Performance preservada:** WAL + statements preparados + `INSERT OR IGNORE` (dedup en SQL, no en JS).

**Aceptación:** `npx tsx scripts/test-db.ts` corre limpio; DB queda en `app.getPath('userData')`; reinsertar mismo `wa_msg_id` da `changes === 0`.

---

## Etapa 3 — Vinculación WhatsApp (QR + persistencia de sesión)

**Backend**
- `electron/services/whatsapp.ts` con todos los flags críticos del BRIEF (`makeCacheableSignalKeyStore`, `getMessage` definido, `syncFullHistory`, `markOnlineOnConnect: false`, timeouts, retries).
- `useMultiFileAuthState` en `userData/auth/`.
- `connection.update`: backoff exponencial cap 30s, manejo de `loggedOut` (borrar auth + emitir evento).
- IPC: `wa:qr`, `wa:connection-state`, `wa:logged-out`, `wa:request-qr`, `wa:logout`.
- `connect()` arranca **antes** de mostrar window.

**Frontend**
- `views/Onboarding.tsx` paso 1: render del QR (lib `qrcode` → dataURL → `<img>`).
- Estados visuales: "Generando QR" / "Esperando escaneo" / "Conectado".
- Routing: si hay sesión válida saltea onboarding.
- Tray menu refleja estado real.

**Performance preservada:** `makeCacheableSignalKeyStore` (clave del rendimiento de Baileys), conexión persistente (no reconectar por mensaje).

**Aceptación:** primer arranque muestra QR → escaneo vincula → reabrir no pide QR; cortar Wi-Fi reconecta solo sin reescanear.

---

## Etapa 4 — Captura en tiempo real + offline catch-up (sin embeddings aún)

**Backend**
- `electron/services/ingest.ts`: `extractText` (conversation, extendedTextMessage, captions), `ingestMessage(waMsg, meta)` con `INSERT OR IGNORE`.
- Handlers en `whatsapp.ts`:
  - `messages.upsert` procesando **ambos** types (`notify` → `realtime`, `append` → `offline-sync`).
  - `messaging-history.set` → `history-sync`.
  - Filtro por `remoteJid === sock.user.id`.
- Logger pino estructurado (`{ service, event, wa_msg_id, source }`).
- IPC: `app:get-message-count`, evento `message:ingested`.

**Frontend**
- Vista "Inbox" provisional con contador de mensajes en tiempo real (suscripción a `message:ingested`).
- Lista cronológica básica (últimos N) — ya es la **base del Timeline** futuro.

**Performance preservada:** filtrado en main process (no enviamos ruido al renderer), dedup en SQL, IPC throttled (un evento batched por tick si entran muchos mensajes juntos).

**Aceptación:** mensaje desde el cel aparece en <5s; tras apagar PC + 3 mensajes + prender → los 3 entran como `offline-sync`; reiniciar app no duplica.

---

## Etapa 5 — Embeddings + búsqueda semántica

**Backend**
- `electron/services/embeddings.ts`: singleton `feature-extraction` con `Xenova/multilingual-e5-small`, `cacheDir` en userData, lazy init con progreso vía `sync:progress`.
- Queue de embeddings con concurrencia 1 + `setImmediate` entre items (no bloquea event loop).
- Modificación de `ingestMessage` para encolar embedding post-INSERT.
- **Backfill** al arrancar: detecta filas en `messages` sin entrada en `message_embeddings` y las procesa en background con prioridad baja.
- `electron/services/search.ts`: KNN query con statement preparado.
- IPC: `search:query`.

**Frontend**
- `views/Search.tsx`: input con **debounce 300ms**, lista con texto + fecha + `(1 - distance) * 100`%, virtualización (`react-window` o similar) para listas largas.
- Indicador de carga del modelo la primera vez (barra de progreso de descarga).
- Loading skeleton en resultados mientras hay query en vuelo.

**Performance preservada:** lazy load del modelo, queue serializada con `setImmediate` (la UI no se congela en history sync), virtualización de la lista, debounce.

**Aceptación:** modelo se descarga y cachea; búsqueda semántica devuelve resultados relacionados; <500ms con 10k mensajes; backfill rellena los embeddings de etapas previas.

---

## Etapa 6 — Import de export chat (.txt) + Timeline view completa

**Backend**
- `electron/services/export-parser.ts`: regex Android + iOS, multilínea, filtros de líneas de sistema, `ParsedMessage[]`.
- `ingestFromExport`: ID sintético SHA-1 determinista, **batch de 50** con `setImmediate` entre tandas, `sync:progress` con `{ processed, total }`.
- IPC: `export:import` con `dialog.showOpenDialog`.
- Embeddings del import: encolados con prioridad baja (no bloquean el realtime).

**Frontend**
- `Onboarding.tsx` paso 2: instrucciones claras (Configuración → Chat → Exportar → Sin medios) + botón de import + barra de progreso.
- `views/Timeline.tsx` real: scroll virtualizado por fecha, agrupación por día, navegación rápida (jump-to-date).
- Re-import disponible desde un menú "Configuración".

**Performance preservada:** batch + yield para 10k mensajes <2min sin congelar UI, IDs deterministas evitan duplicados al re-importar, virtualización del timeline.

**Aceptación:** export Android e iOS parsean; multilínea concatenado correcto; re-import del mismo .txt no duplica; 10k mensajes en <2min; mensajes importados son buscables.

---

## Etapa 7 — Sync Status Badge + notificaciones + polish UX

**Backend**
- Derivación de estado en main process (FSM: `connecting | open | catching-up | idle | disconnected | logged-out | stale-primary`).
- Tracking de "última actividad del primary" para warning de 7+ días (riesgo de logout a los 14).
- Notificaciones nativas Electron al terminar catch-up offline (`new Notification`).
- IPC: `app:get-sync-status` + push `sync:state-changed`.
- Update del menú del tray con estado.

**Frontend**
- `components/SyncStatusBadge.tsx` con los 4 estados + warning del primary.
- Badge en header de Search y Timeline (no en Onboarding).
- Toast/inline cuando llega `wa:caught-up` con conteo.
- Animaciones discretas (badge pulsa en `catching-up`).
- Pasada de pulido: spacing, tipografía, iconografía consistente con el pitch deck.

**Aceptación:** estado visible y correcto en todo momento; cortar Wi-Fi → 🔴 con countdown; reconexión limpia; notificación nativa tras catch-up; warning aparece a los 7 días.

---

## Etapa 8 — Settings + observability mínima + edge cases

**Por qué existe:** el BRIEF salta de UX a packaging, pero hay panel de settings y handling de errores user-facing que conviene cerrar antes de empacar.

**Backend**
- IPC: `settings:get`, `settings:set`, `wa:logout` (ya existe), `db:stats` (conteo, tamaño, última ingesta).
- Manejo explícito de errores user-facing (no `try/catch` que silencia): canal `app:error` con `{ code, message, recoverable }`.
- Log rotativo de pino (cap de tamaño en userData).

**Frontend**
- `views/Settings.tsx`: estado de sesión, botón "Desvincular WhatsApp", botón "Reimportar export", stats de la DB, path del userData (botón "Abrir carpeta"), toggle de autostart.
- Componente `<ErrorBoundary>` + toast de errores.
- Empty states claros (sin mensajes aún, sin resultados de búsqueda, etc.).

**Aceptación:** settings completo y funcional; desvincular limpia auth y vuelve a Onboarding; errores nunca quedan silenciosos.

---

## Etapa 9 — Packaging y distribución

**Backend / build**
- `electron-builder.yml`: `appId`, `productName`, targets (nsis/dmg/AppImage), iconos, `extraResources` si hace falta.
- `postinstall` con `electron-builder install-app-deps` (rebuild de `better-sqlite3` y `onnxruntime-node`).
- Modelo de embeddings se descarga al primer arranque (no en el instalador).

**Frontend**
- README con instalación, uso, desarrollo y troubleshooting (modelo descargando, primary 14 días, etc.).
- Splash mínimo en el primer arranque mientras se descarga el modelo.

**Aceptación:** `npm run package` genera instalador; instalación limpia funciona end-to-end; autostart desde el instalador OK.

---

## Resumen de optimizaciones preservadas

| Optimización del BRIEF | Etapa donde se introduce |
|---|---|
| WAL + pragmas + statements preparados | 2 |
| `makeCacheableSignalKeyStore` + `getMessage` | 3 |
| Backoff exponencial cap 30s | 3 |
| Dedup en SQL (`INSERT OR IGNORE`) | 4 |
| Filtrado en main, no en renderer | 4 |
| Lazy load del modelo + cache en userData | 5 |
| Queue de embeddings con `setImmediate` | 5 |
| Debounce + virtualización de listas | 5–6 |
| Batch de import con yield cada 50 | 6 |
| IDs sintéticos deterministas | 6 |
| Backfill background no bloqueante | 5 |

---

## Reglas de operación

- **No avanzar de etapa sin completar el criterio de aceptación.** Si hay duda, parar y preguntar.
- **Commit por etapa**: `feat(etapa-N): descripción corta`.
- **Tests manuales**: al cerrar cada etapa, dejar pasos de reproducción del criterio en `docs/testing-stage-N.md`.
- **Decisiones técnicas fuera del BRIEF/STAGES**: preguntar antes de improvisar.
