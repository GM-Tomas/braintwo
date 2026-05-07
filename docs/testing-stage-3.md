# Etapa 3 — Vinculación con WhatsApp + tests

## Suite automática

```bash
npm test              # 77 tests
npm run test:coverage # con threshold 80% global
```

### Lo que cubre

| Archivo | Tests | Métrica clave |
|---|---|---|
| [whatsapp-state.test.ts](../electron/services/whatsapp-state.test.ts) | 15 | 100% en todo |
| [whatsapp.test.ts](../electron/services/whatsapp.test.ts) | 25 | 99.45% lines, 78% functions (defaults sin DI) |
| [db.test.ts](../electron/services/db.test.ts) | 37 | 100% lines |

Coverage global: **99.69% lines / 89.58% branches / 87.17% functions / 99.69% statements** — todos por encima del threshold de 80%.

### Casos clave probados en `whatsapp.ts`

- Socket factory recibe los flags **NO negociables del BRIEF**: `syncFullHistory: true`, `markOnlineOnConnect: false`, `keepAliveIntervalMs: 25000`, `connectTimeoutMs: 60000`, `defaultQueryTimeoutMs: 60000`, `retryRequestDelayMs: 1000`, `maxMsgRetryCount: 5`, `getMessage` definido.
- `getMessage` siempre devuelve `undefined` (resuelve sin tirar) — sin esto los retries de cifrado fallan en silencio según el BRIEF.
- `creds.update` invoca `saveCreds` y tolera errores sin tirar.
- QR transitions: `qr` event emite + persiste `currentQr`; `open` lo limpia.
- Backoff exponencial: 1000 → 2000 → 4000 → … capped en 30s; reset al `open`.
- `loggedOut` (code 401): clear auth folder + emit `logged-out`, no reconnect.
- `stop()` cancela timer pendiente, llama `socket.end()`, ignora close events tardíos.
- `logout()` activo: socket.logout + rmAuth + emit + estado terminal.
- `connect()` falla → schedule reconnect con backoff (no quita).
- Defaults (sin DI) ejercen `setTimeout`/`clearTimeout` reales y `pino()` silencioso.

## Cambios estructurales del proyecto

### Switch a ESM en main + preload

Baileys 7.x es **ESM-only**. Nuestro main bundle estaba en CJS desde Etapa 0 (decisión forzada por el bug de `ELECTRON_RUN_AS_NODE=1` antes de tener el wrapper). Ahora con el wrapper, ESM funciona.

Cambios:
- `package.json`: `"type": "module"`, `"main": "out/main/main.mjs"`.
- `electron.vite.config.ts`: `formats: ['es']` y `entryFileNames: '[name].mjs'` para main + preload.
- `electron/main.ts`: usa `fileURLToPath(import.meta.url)` para `__dirname`.
- `postcss.config.js` → `postcss.config.cjs` (postcss requiere CJS para esa config; renderer toma esto sin problema).

Build output:
```
out/main/main.mjs       (~12 KB)
out/preload/preload.mjs (~1 KB)
out/renderer/...        (~277 KB con qrcode bundled)
```

## Pasos de aceptación manual

> Dependen de tener **WhatsApp en el celular** y red disponible. En el sandbox de CI no se ejercita la parte real de pairing.

### 1. Primer arranque muestra QR

```bash
npm run dev
```

- Ventana abre con header "Conectando…" en el badge.
- Onboarding view: estado "Generando QR…" con pulse, luego dibuja un QR cuando llega de Baileys (≈3-5s).
- Steps "1-2-3" visibles guiando al usuario a Configuración → Dispositivos vinculados → Vincular un dispositivo.

### 2. Escaneo vincula

- Escanear el QR con WhatsApp del celular.
- En segundos: badge pasa a "Conectado", PairingPanel muestra ✓ verde.
- App auto-rutea a la vista "Buscar".

### 3. Persistencia post-cierre

- Cerrar app (tray → Salir).
- Volver a `npm run dev`.
- Esperado: NO pide QR, conecta directo (la sesión está en `userData/auth/`).

### 4. Reconexión automática

- Mientras está conectada, desactivar Wi-Fi.
- Esperado: badge pasa a "Reconectando…" (state `disconnected`).
- Reactivar Wi-Fi.
- Esperado: vuelve a "Conectado" sin reescanear QR. Backoff: 2s → 4s → 8s → … cap 30s.

### 5. Logout activo

- Settings (futuro) → "Desvincular WhatsApp" o desde el celular: WhatsApp → Dispositivos → desvincular BrainTwo.
- Esperado: estado pasa a "Sesión cerrada", carpeta `userData/auth/` se borra, view vuelve a Onboarding con botón "Generar QR de nuevo".

## Trampas conocidas

- **Sesiones de 14 días**: si el celular está más de 14 días sin tocar WhatsApp, el linked device se desloguea. Se cubrirá con warning en UI a los 7 días en Etapa 7.
- **Baileys ESM-only**: cualquier servicio nuevo en main que importe Baileys 7.x debe estar en un archivo ESM; Vite/Rollup ya genera ESM. Si hubiera que volver a CJS, usar dynamic `import()` para Baileys.
- **`ELECTRON_RUN_AS_NODE=1` global**: ya neutralizado por `scripts/run-evite.mjs`. No remover ese wrapper.
- **No agregamos `electron-builder install-app-deps` aún** porque Stage 3 sólo carga Baileys (JS puro) en main. En Etapa 4 cuando se wire-ee `db.ts` desde main, sumar el rebuild para `better-sqlite3`.
