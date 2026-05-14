# BrainTwo — Estado actual + roadmap de cierre

> Generado al cierre del commit `8fd80c4`. Resume qué está hecho, qué quedó frágil y qué falta para terminar las etapas del BRIEF.

---

## 1. Lo que ya funciona (Etapas 0 a 4 + extras)

### Sistema de archivos del proyecto y commits relevantes

| Commit | Etapa | Qué entrega |
|---|---|---|
| `f7995a6` | **Etapa 1** | Shell de SO: tray, autostart, single-instance, hide-on-close |
| `6af497c` | **Etapa 2** | SQLite + sqlite-vec, schema, statements preparados, WAL, dedup en SQL |
| `b6bc52f` | **Etapa 3** | Baileys 7 + QR + pairing + persistencia + reconnect/backoff |
| `c8d5f2d` | **Etapa 4** | Captura realtime + offline catch-up + history-sync, ingest con dedup |
| `bc4f33e` | UI design | Sidebar + PageHeader + Bebas/Outfit + paleta del Claude Design handoff |
| `3d194c0` | extra | Captura y render de **audio / image / video / document / sticker** |
| `2c53586` | infra | Marker-based ABI rebuilder (`rebuild:electron` / `rebuild:node`) |
| `cdd3926` | fix | Preload pasado a CJS (Baileys 7 ESM en main, preload CJS) |
| `c8d0dac` | fix | ErrorBoundary visible, DevTools auto en dev, CSP solo en prod |
| `d1b1f6a` | fix | Self-chat match por LID + PN + preferred variantes + diagnósticos |
| `8fd80c4` | fix | Cola de mensajes tempranos hasta que `creds.me` resuelve los JIDs |

### Métricas técnicas

- ~290+ tests automáticos pasando, cobertura global > 95% lines / 90% branches
- TypeScript strict mode en todo
- Coverage threshold `80%` configurado y respetado
- Architecture: ESM main + CJS preload + ESM renderer (Vite + React 18 + Tailwind)

### Funcional para el usuario

- Onboarding: FTU welcome cards → QR → pairing → auto-rutea a búsqueda al primer `open`
- Sidebar con estado de conexión live (Conectando / Conectado / Reconectando / Sesión cerrada)
- Cerrar al tray, single-instance, autostart
- Ingest del chat conmigo mismo (texto + audios + imágenes + videos + documentos + stickers)
- Timeline con filtros por kind (Todo / Textos / Audios / Imágenes / Videos / Archivos)
- Búsqueda placeholder con sugerencias y página de "coming soon"
- ABI auto-rebuild (`predev` / `pretest`) entre Electron y Node sin intervención manual

---

## 2. Issues abiertos / frágiles

### Verificar tras `8fd80c4` (queueing de mensajes tempranos)

- ¿Aparecen mensajes ahora en Timeline? Sería el test final del fix del JID matching.
- Los logs `[wa] messages.upsert processed total=N kept=K skipped=S` en la terminal de dev te muestran exactamente qué pasa cada vez que llega un batch.

### Frágil por arquitectura

- **better-sqlite3 ABI**: cada vez que actualizás Electron o cambiás de Node global, hay que `rm -rf .abi` + relanzar. Hoy la app no detecta el mismatch hasta el primer crash.
- **Linked-device 14 días**: si tu cel pasa 14 días sin abrir WhatsApp, todos los linked devices se desloguean — vamos a sumar warning a los 7 días en Etapa 7.
- **Sesión inicial de Baileys**: el bundle inicial post-pairing trae 50–500 mensajes recientes y nada más. Para histórico completo hace falta el import `.txt` (Etapa 6).

### Items huérfanos en la repo

- `docs/BrainTwo — Web App.pdf` y `docs/WhatsApp Image 2026-04-09 ...` están untracked — chequeá si son sobra o si los queremos versionados.
- Onboarding/Sidebar tests cambiaron `…` por `...` recientemente; alineado pero conviene chequear que no haya inconsistencia con strings que sí usan `…` en componentes.

---

## 3. Lo que falta — etapa por etapa

### Etapa 5 — Embeddings + búsqueda semántica

**Backend**
- `electron/services/embeddings.ts`: singleton con `pipeline('feature-extraction', 'Xenova/multilingual-e5-small')`.
- Cache del modelo en `app.getPath('userData')/models/` vía `env.cacheDir`.
- Lazy init: el modelo se descarga la primera vez (~120 MB), con progreso reportado vía IPC.
- **Queue serializada** con `setImmediate` entre items para no bloquear el event loop. Crítico durante history-sync (cientos de mensajes seguidos).
- **Backfill**: al arrancar, query `messages` sin entrada en `message_embeddings` → procesar en background con prioridad baja.
- `electron/services/search.ts`: `searchSimilar(queryVec, k)` con statement preparado. Esta query KNN ya existe en `db.ts`, solo hay que wirearla con texto plano.
- IPC: `search:query(text, k)` → embed → KNN → top-k mensajes con distancia.

**Frontend**
- `Search.tsx`: debounce 300 ms en el input, llamar `search:query`, render de resultados con texto, fecha, y porcentaje de similitud (`(1 - distance) * 100`).
- Estado de "descargando modelo" durante el primer arranque.
- Virtualización (`react-window` o similar) para listas largas.

**Tests nuevos** (objetivo ~30 más)
- `embeddings.ts`: lazy init, queue serializada, dimensión de salida 384, cache reuse.
- `search.ts`: KNN ordering, k-limit, vec dim mismatch.
- Backfill: detecta y procesa los mensajes pre-existentes.

**Costo estimado**: 1-2 días. Alta densidad de cosas técnicas (model download, queue, IPC progress). El esquema de la DB ya está listo (`message_embeddings` con `vec0` 384 dim).

---

### Etapa 6 — Import del export `.txt` + Timeline avanzada

**El problema que resuelve**: WhatsApp NO permite a un linked device bajar el histórico completo. El BRIEF lo cubre con la "doble fuente": pairing + export `.txt`. Hoy solo tenés la primera mitad.

**Backend**
- `electron/services/export-parser.ts`:
  - Regex Android: `16/3/2024 14:32 - Vos: mensaje`
  - Regex iOS: `[16/3/2024, 14:32:15] Vos: mensaje`
  - Líneas multilínea (líneas sin patrón pertenecen al mensaje anterior)
  - Filtrar líneas de sistema: cifrado E2E, "X cambió su número", `<Multimedia omitido>`, etc.
  - Devuelve `ParsedMessage[]` con `{ timestamp, sender, text }`.
- `ingestFromExport(parsed)`:
  - ID sintético determinista: `'export:' + sha1(timestamp + '|' + text).slice(0, 24)`
  - Source: `'export'`
  - Batch de 50 con `setImmediate` entre tandas para no congelar
  - Emite `sync:progress` con `{ processed, total }`
- IPC: `export:import` → `dialog.showOpenDialog` para `.txt`.

**Frontend**
- `Onboarding.tsx`: paso 2 después del QR, con instrucciones claras (Configuración → Chat → Exportar → Sin medios) + botón "Importar histórico".
- Barra de progreso durante el import.
- Timeline avanzada: scroll virtualizado por fecha, agrupación por día, "jump to date".

**Tests** (~20 más)
- Parser Android + iOS con edge cases (multilínea, sistema, multimedia omitido).
- Re-import del mismo `.txt` → 0 duplicados (gracias a IDs deterministas).
- 10.000 mensajes en <2 min sin congelar UI (perf test).

**Costo**: 1 día. Mucho regex + edge cases pero todo determinista y testeable.

---

### Etapa 7 — Sync Status Badge + notificaciones + polish UX

Hoy tenés un dot + texto de estado en el sidebar. Etapa 7 lo lleva a algo más informativo.

**Backend**
- FSM más rica en main: `connecting | open | catching-up | idle | disconnected | logged-out | stale-primary`.
- Tracking de "última actividad del primary" para warning a los 7 días (riesgo de logout a 14).
- `new Notification('BrainTwo', { body: '12 mensajes nuevos sincronizados' })` al terminar offline catch-up.
- IPC: `app:get-sync-status`, push `sync:state-changed`.
- Tray menu actualizado con estado actual.

**Frontend**
- `components/SyncStatusBadge.tsx` con los 4 estados + warning del primary (⚠️ "El primary phone lleva X días sin actividad").
- Animación discreta (badge pulsa en `catching-up`).
- Toast/inline cuando llega `wa:caught-up` con conteo.
- Pasada de pulido visual: spacing, tipografía, iconografía consistente.

**Tests** (~10-15 más)
- FSM transitions desde main.
- Warning a los 7 días.
- Notif nativa al caught-up.

**Costo**: medio día.

---

### Etapa 8 — Settings + observability + edge cases

Esto cierra cabos sueltos antes de empacar.

**Backend**
- IPC: `settings:get`, `settings:set`, `db:stats` (count, tamaño en bytes, última ingesta), `app:open-userdata-folder`.
- Manejo explícito de errores user-facing: canal `app:error` con `{ code, message, recoverable }`.
- Log rotativo de pino (cap de tamaño en `userData/logs/`).

**Frontend**
- `views/Settings.tsx`:
  - Estado de sesión (tu número + fecha de pairing)
  - Botón "Desvincular WhatsApp" (ya existe en sidebar, traerlo acá también)
  - Botón "Reimportar export"
  - Stats de la DB (mensajes totales, tamaño, embeddings procesados)
  - Path del userData con botón "Abrir carpeta"
  - Toggle de autostart (`app.setLoginItemSettings`)
- `<ErrorBoundary>` ya existe, hay que conectar el canal `app:error` para errores de main que necesitan render.
- Empty states más cuidados (sin mensajes, sin resultados, sin export).

**Tests** (~15 más)
- Settings IPC channels.
- Toggle autostart.
- Error boundary con canal `app:error`.

**Costo**: medio día.

---

### Etapa 9 — Packaging y distribución

**Backend / build**
- `electron-builder.yml` completo:
  - Targets: `nsis` (Windows), `dmg` (macOS), `AppImage` (Linux)
  - Iconos: `build/icon.png` 512×512, `build/icon.ico` (Windows), `build/icon.icns` (macOS) — los placeholders generados por script ya existen pero conviene reemplazarlos por arte definitivo
  - `extraResources` para los iconos del tray (ya configurado)
- `postinstall` con `electron-builder install-app-deps` para rebuild de native deps en CI.
- El modelo de embeddings (~120 MB) NO se empaca en el instalador — se descarga al primer arranque (que ya está implementado en Etapa 5).

**Frontend**
- README con instalación + uso + desarrollo + troubleshooting (modelo descargando, primary 14 días, etc.).
- Splash mínimo en el primer arranque mientras el modelo descarga.

**Costo**: medio día (más tiempo de testing en máquinas distintas).

---

## 4. Decisiones de scope que afectan el roadmap

Antes de avanzar, son estas las preguntas abiertas:

| Decisión | Status |
|---|---|
| **Multi-chat** (capturar otros chats además de "yo a yo") | NO en BRIEF v1, pero te interesó. Si se mete, añade ~1 día (schema `chat_jid`, UI selector, migración) |
| **Clasificación zero-shot** (etiquetas idea/tarea/link/recordatorio con `mDeBERTa-v3-base-mnli-xnli`) | Listada en BRIEF para v1.1 — fuera de v1 |
| **Manejo de binarios de medios** (descargar audios para reproducir, imágenes thumbnails) | Hoy capturás solo metadata. Reproducir audios requiere otro flow + storage. Estimado 2-3 días |
| **Detección de links + previews** (open-graph fetch) | v1.1 |
| **Tags manuales** | v1.1 |
| **Reconciliación periódica con export** (re-importar el `.txt` mensualmente) | v1.1 |
| **Transcripción de audios local** (Whisper) | v2 según BRIEF |
| **Watchdog de conexiones zombi** + power monitor (suspend/resume del SO) | v2 según BRIEF |

---

## 5. Resumen ejecutivo

**Lo que falta para llegar al v1 cerrado del BRIEF: ~3-4 días de trabajo**

### Orden recomendado y por qué

1. **Etapa 5** primero (embeddings + búsqueda) — da valor inmediato, el ingest ya tiene mensajes para indexar.
2. **Etapa 6** después (export `.txt` import) — sin esto la búsqueda solo cubre los últimos N mensajes que Baileys baja en el bundle.
3. **Etapa 7** (badges + notifs) — cosmético / observability, no bloquea funcionalidad.
4. **Etapa 8** (settings) — ergonomía + manejo de errores.
5. **Etapa 9** (packaging) — al final, cuando todo lo demás está pulido.

### Si querés acelerar el "WoW factor" para el seminario

Etapa 5 + Etapa 6 son el 80% del valor. Las 7 + 8 son polish. La 9 puede ser un demo `npm run dev` si la entrega no requiere instalador.

---

*Próximo paso: confirmar si avanzamos con Etapa 5 (embeddings + búsqueda) o si primero metemos alguna decisión de scope (multi-chat, manejo de binarios).*
