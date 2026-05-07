# Etapa 2 — DB + suite automática

## Suite automática

```bash
npm test               # corre la suite (vitest)
npm run test:watch     # modo watch para desarrollo
npm run test:coverage  # corre + reporta cobertura con threshold 80%
```

### Lo que cubre

[electron/services/db.test.ts](../electron/services/db.test.ts) — 37 tests sobre [electron/services/db.ts](../electron/services/db.ts):

| Bloque | Tests |
|---|---|
| `schema & migrations` | 5 — tablas, índice, UNIQUE, idempotencia, pragmas re-aplicables |
| `pragmas` | 3 — synchronous, temp_store, foreign_keys |
| `insertMessage` | 8 — happy path, persistencia exacta, dedup `INSERT OR IGNORE`, null/undefined raw_json, todos los `MessageSource`, contador |
| `insertEmbedding` | 6 — 384 dim válido, rechazo (under/over/empty), conflicto de PK, hasEmbedding |
| `searchSimilar (KNN)` | 6 — orden ascendente por distancia, k limit, vacío, k≤0, dim inválida, fields completos |
| `singleton lifecycle` | 3 — getDb idempotente, closeDb resetea, closeDb sin instancia es noop |
| `db file persistence` | 4 — archivo creado, WAL aplicado, mensajes y embeddings persisten cross-reopen |

### Cobertura actual

```
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered
----------|---------|----------|---------|---------|----------
db.ts     |   100   |  88.46   |  100    |  100    | 143,146,149
```

Las branches sin cubrir son los fallbacks `?? 0` defensivos en `countMessages`/`countEmbeddings`/`hasEmbedding` — `COUNT(*)` de SQLite siempre devuelve una fila, así que el camino `undefined` es alcanzable solo por defensa de tipos. Threshold de 80% en `lines/branches/functions/statements` configurado en [vitest.config.ts](../vitest.config.ts).

### Cuándo agregar tests

Cualquier servicio nuevo en `electron/services/**` arrastra coverage y debe llegar al 80%. La cobertura está scoped a `electron/services/**` solamente (main.ts/preload.ts son entry-points integradores, se validan manualmente con los `docs/testing-stage-N.md`).

## Smoke manual rápido

```bash
node -e '
import("./electron/services/db.ts").catch(() => {})
'
```

(El módulo no se ejecuta en main process aún — eso llega en Etapa 4.)

## Trampas conocidas

- **`vec0` exige `BigInt` para el PK**: aunque la columna es `INTEGER`, `sqlite-vec` rechaza JS numbers (los considera REAL). `db.insertEmbedding` castea `BigInt(msgId)` automáticamente. Si en el futuro insertás directamente, recordá el cast.
- **Native modules + Electron**: `better-sqlite3` se prebuilda para Node ABI. Cuando se wire-ee `db.ts` desde el main process (Etapa 4 en adelante), agregar `electron-builder install-app-deps` al `postinstall` para rebuildar contra la ABI de Electron.
- **Windows + WAL + rmSync**: si un test deja un handle abierto sobre una DB de archivo y el `afterEach` intenta borrar el directorio, Windows tira `EBUSY`. Asegurate de cerrar `db.close()` siempre antes del cleanup. La suite actual lo hace.
- **Coverage del `?? 0`**: las ramas defensivas que TypeScript exige por null-safety pero son inalcanzables en runtime no se cubren a propósito. No son objetivo de tests.
