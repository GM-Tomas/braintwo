# Etapa 1 — Pasos de testing manual

## Pre-requisitos

- Sistema operativo: Windows 10/11 (target principal). En macOS/Linux varía el comportamiento del autostart y el tray.
- `npm install` completado.
- Variable de entorno `ELECTRON_RUN_AS_NODE` **no debe estar seteada** (los scripts de npm la limpian automáticamente vía `scripts/run-evite.mjs`).

## Pasos de aceptación

### 1. Arranque limpio

```bash
npm run dev
```

**Esperado:**
- Vite compila main + preload + renderer sin errores.
- Última línea de la terminal: `start electron app...`.
- En menos de 5s aparece la ventana de BrainTwo (1200x800, theme oscuro).
- Header muestra "BrainTwo · Iniciando…" y la versión `v0.1.0` + plataforma.
- En el system tray aparece el ícono cuadrado azul.

### 2. Cerrar al tray, reabrir <100ms

1. Click en la X de la ventana.
2. **Esperado:** la ventana desaparece pero el ícono del tray sigue ahí (la app no muere).
3. Click izquierdo en el ícono del tray.
4. **Esperado:** la ventana reaparece instantáneamente (no hay reload, conserva el estado del routing).

### 3. Salir explícito desde el tray

1. Click derecho sobre el ícono del tray → "Salir".
2. **Esperado:** el ícono desaparece del tray, el proceso `electron` desaparece del Task Manager.

### 4. Single-instance lock

1. Mientras la app está corriendo, abrí otra terminal y ejecutá `npm run dev` de nuevo.
2. **Esperado:** la segunda instancia se cierra inmediatamente y la primera ventana se enfoca al frente.

### 5. Autostart con el SO (sólo build packaged, NO en dev)

> En modo `npm run dev` el autostart está deshabilitado a propósito (ver `configureAutostart()` en `electron/main.ts`). Probar después de Etapa 9 con el instalador real.

1. Instalar la app empaquetada.
2. Reiniciar el SO.
3. **Esperado:** la app aparece en el tray automáticamente, sin ventana visible (`openAsHidden: true` + `--hidden` arg).
4. Click en el tray abre la ventana.

### 6. Menú del tray refleja estado

- Click derecho en tray.
- **Esperado:** ítems "Abrir BrainTwo", "Estado: Listo" (deshabilitado), separador, "Salir".

## Issues conocidos

- En entornos headless (CI, sandbox sin display) el ícono del tray puede no renderizar. La validación visual requiere una sesión de escritorio real.
- `ELECTRON_RUN_AS_NODE=1` exportado globalmente rompe Electron (binario actúa como Node). Si arrancás el `.exe` empaquetado y ves crash con `Cannot read properties of undefined (reading 'whenReady')`, esa es la causa — limpiala del entorno.
