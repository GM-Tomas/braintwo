import { VEC_DIM } from './db'
import { logError } from './logger'

export type ModelProgressStatus = 'idle' | 'downloading' | 'ready' | 'fallback' | 'error'

export interface ModelProgress {
  status: ModelProgressStatus
  message?: string
  progress?: number
}

export type EmbedType = 'query' | 'passage'
export type Embedder = (text: string, type?: EmbedType) => Promise<Float32Array> | Float32Array

export interface EmbeddingService {
  embed: (text: string, type?: EmbedType) => Promise<Float32Array>
  getStatus: () => ModelProgress
}

export interface EmbeddingServiceDeps {
  cacheDir: string
  modelName?: string
  embedder?: Embedder
  pipelineFactory?: (progress: (p: ModelProgress) => void) => Promise<Embedder>
  onProgress?: (progress: ModelProgress) => void
  scheduler?: (cb: () => void) => unknown
}

const DEFAULT_MODEL = 'Xenova/multilingual-e5-base'

export function createEmbeddingService(deps: EmbeddingServiceDeps): EmbeddingService {
  const schedule = deps.scheduler ?? ((cb) => setImmediate(cb))
  let status: ModelProgress = { status: 'idle' }
  let initPromise: Promise<Embedder> | null = null
  let queue = Promise.resolve()

  function publish(next: ModelProgress): void {
    status = next
    deps.onProgress?.(next)
  }

  async function init(): Promise<Embedder> {
    if (deps.embedder) {
      publish({ status: 'ready', message: 'Modelo listo' })
      return deps.embedder
    }
    if (!initPromise) {
      initPromise = initTransformerEmbedder(deps, publish).catch((err) => {
        logError('embeddings:init', err, 'Failed to initialize local transformer model, falling back to deterministic embedder')
        publish({
          status: 'fallback',
          message: 'Modelo local no disponible; usando busqueda offline deterministica'
        })
        return deterministicEmbedder
      })
    }
    return initPromise
  }

  return {
    embed(text, type = 'passage') {
      const task = queue.then(
        () =>
          new Promise<Float32Array>((resolve, reject) => {
            schedule(() => {
              void init()
                .then((embedder) => Promise.resolve(embedder(text, type)))
                .then(resolve, reject)
            })
          })
      )
      queue = task.then(
        () => undefined,
        () => undefined
      )
      return task
    },
    getStatus() {
      return status
    }
  }
}

async function initTransformerEmbedder(
  deps: EmbeddingServiceDeps,
  publish: (p: ModelProgress) => void
): Promise<Embedder> {
  if (deps.pipelineFactory) {
    return deps.pipelineFactory(publish)
  }
  publish({ status: 'downloading', message: 'Preparando modelo semantico', progress: 0 })
  const importer = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<{
    env?: { cacheDir?: string }
    pipeline: (
      task: string,
      model: string,
      opts?: Record<string, unknown>
    ) => Promise<(text: string, opts?: Record<string, unknown>) => Promise<unknown>>
  }>
  const mod = await importer('@xenova/transformers')
  if (mod.env) mod.env.cacheDir = deps.cacheDir
  const pipe = await mod.pipeline('feature-extraction', deps.modelName ?? DEFAULT_MODEL, {
    progress_callback: (evt: unknown) => {
      const progress = normalizeProgress(evt)
      publish({ status: 'downloading', message: 'Descargando modelo', progress })
    }
  })
  publish({ status: 'ready', message: 'Modelo listo', progress: 1 })
  return async (text: string, type: EmbedType = 'passage') => {
    const output = await pipe(`${type}: ${text}`, { pooling: 'mean', normalize: true })
    return normalizeVector(output)
  }
}

function normalizeProgress(evt: unknown): number | undefined {
  if (!evt || typeof evt !== 'object') return undefined
  const obj = evt as { progress?: unknown; loaded?: unknown; total?: unknown }
  if (typeof obj.progress === 'number') return clamp01(obj.progress / 100)
  if (typeof obj.loaded === 'number' && typeof obj.total === 'number' && obj.total > 0) {
    return clamp01(obj.loaded / obj.total)
  }
  return undefined
}

function normalizeVector(output: unknown): Float32Array {
  const candidate = output as { data?: unknown; dims?: number[] }
  if (candidate?.data instanceof Float32Array) return ensureDim(candidate.data)
  if (Array.isArray(candidate?.data)) return ensureDim(Float32Array.from(candidate.data as number[]))
  if (Array.isArray(output)) return ensureDim(Float32Array.from(output as number[]))
  return deterministicEmbedder(JSON.stringify(output))
}

function ensureDim(vec: Float32Array): Float32Array {
  if (vec.length === VEC_DIM) return vec
  const out = new Float32Array(VEC_DIM)
  out.set(vec.slice(0, VEC_DIM))
  return normalize(out)
}

export function deterministicEmbedder(text: string): Float32Array {
  const out = new Float32Array(VEC_DIM)
  const tokens = text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  const source = tokens.length ? tokens : ['empty']
  for (const token of source) {
    let h = 2166136261
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const idx = Math.abs(h) % VEC_DIM
    out[idx] += 1
    out[(idx * 31 + token.length) % VEC_DIM] += 0.35
  }
  return normalize(out)
}

function normalize(vec: Float32Array): Float32Array {
  let mag = 0
  for (let i = 0; i < vec.length; i++) mag += vec[i]! * vec[i]!
  mag = Math.sqrt(mag) || 1
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! / mag
  return vec
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
