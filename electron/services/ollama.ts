import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, chmodSync, createWriteStream, unlinkSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import type {
  OllamaInstallProgress,
  OllamaModel,
  OllamaPullProgress,
  OllamaStatus
} from '@shared/types'

// ─── Binary detection ────────────────────────────────────────────────────────

function findOllamaBinary(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where ollama' : 'which ollama'
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    const p = result.trim().split('\n')[0]?.trim()
    if (p && existsSync(p)) return p
  } catch { /* not in PATH */ }

  const home = homedir()
  const candidates: string[] = process.platform === 'win32'
    ? [
        join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'Ollama', 'ollama.exe'),
        join(process.env['PROGRAMFILES'] ?? '', 'Ollama', 'ollama.exe'),
      ]
    : [
        '/usr/local/bin/ollama',
        '/usr/bin/ollama',
        join(home, '.local', 'bin', 'ollama'),
        join(home, '.ollama', 'bin', 'ollama'),
      ]

  return candidates.find(p => existsSync(p)) ?? null
}

// ─── Install helpers ─────────────────────────────────────────────────────────

async function downloadWithProgress(
  url: string,
  dest: string,
  onBytes: (downloaded: number, total: number) => void
): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`)

  const total = parseInt(res.headers.get('content-length') ?? '0', 10)
  let downloaded = 0

  mkdirSync(dirname(dest), { recursive: true })
  const fileStream = createWriteStream(dest)

  if (!res.body) throw new Error('Sin body en la respuesta')

  const reader = res.body.getReader()
  await new Promise<void>((resolve, reject) => {
    function pump(): void {
      reader.read().then(({ done, value }) => {
        if (done) {
          fileStream.end()
          fileStream.once('finish', resolve)
          fileStream.once('error', reject)
          return
        }
        downloaded += value.length
        onBytes(downloaded, total)
        if (!fileStream.write(value)) {
          fileStream.once('drain', pump)
        } else {
          pump()
        }
      }).catch(reject)
    }
    pump()
  })
}

// ─── Service interface ───────────────────────────────────────────────────────

export interface OllamaService {
  isPulling(): boolean
  isInstalling(): boolean
  getStatus(serverUrl: string): Promise<OllamaStatus>
  install(onProgress: (p: OllamaInstallProgress) => void): Promise<void>
  startServer(serverUrl: string): Promise<void>
  stopServer(): void
  isRunningByUs(): boolean
  listModels(serverUrl: string): Promise<OllamaModel[]>
  pullModel(serverUrl: string, name: string, onProgress: (p: OllamaPullProgress) => void): Promise<void>
  cancelPull(): void
  deleteModel(serverUrl: string, name: string): Promise<void>
  warmupModel(serverUrl: string, modelName: string): Promise<void>
  dispose(): void
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createOllamaService(): OllamaService {
  let serverProcess: ChildProcess | null = null
  let managedByUs = false
  let pullController: AbortController | null = null
  let installingNow = false
  let knownBinary: string | null = null

  async function checkHealth(serverUrl: string): Promise<boolean> {
    try {
      const res = await fetch(serverUrl, { signal: AbortSignal.timeout(2000) })
      return res.ok
    } catch {
      return false
    }
  }

  return {
    isPulling() {
      return pullController !== null
    },

    isInstalling() {
      return installingNow
    },

    async getStatus(serverUrl) {
      const binary = knownBinary ?? findOllamaBinary()
      if (!binary) return 'not-installed'
      knownBinary = binary

      const running = await checkHealth(serverUrl)
      return running ? 'running' : 'not-running'
    },

    async install(onProgress) {
      installingNow = true
      try {
        onProgress({ stage: 'downloading', percent: 0, message: 'Iniciando descarga…' })
        const home = homedir()
        const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'

        if (process.platform === 'win32') {
          // Windows: standalone zip → extract to %LOCALAPPDATA%\Programs\Ollama (no UAC prompt)
          const url = 'https://ollama.com/download/ollama-windows-amd64.zip'
          const installDir = join(process.env['LOCALAPPDATA'] ?? home, 'Programs', 'Ollama')
          const tmpArchive = join(tmpdir(), `ollama-${Date.now()}.zip`)
          mkdirSync(installDir, { recursive: true })

          onProgress({ stage: 'downloading', percent: 5, message: 'Descargando Ollama…' })
          await downloadWithProgress(url, tmpArchive, (bytes, total) => {
            onProgress({ stage: 'downloading', percent: total > 0 ? Math.round((bytes / total) * 85) + 5 : 10, message: 'Descargando Ollama…' })
          })

          onProgress({ stage: 'installing', percent: 92, message: 'Extrayendo…' })
          try {
            execSync(
              `powershell -NoProfile -Command "Expand-Archive -Force -Path '${tmpArchive}' -DestinationPath '${installDir}'"`,
              { stdio: 'ignore' }
            )
          } finally {
            try { unlinkSync(tmpArchive) } catch { /* ignore */ }
          }
          const exe = join(installDir, 'ollama.exe')
          if (!existsSync(exe)) throw new Error('No se encontró ollama.exe tras la extracción')
          knownBinary = exe

        } else {
          // Linux: .tar.zst  ·  macOS: .tgz — both extract to ~/.local preserving bin/ + lib/ layout.
          // The binary at ~/.local/bin/ollama discovers its runtime libs at ../lib/ollama.
          const isLinux = process.platform === 'linux'
          const fileName = isLinux ? `ollama-linux-${arch}.tar.zst` : 'ollama-darwin.tgz'
          const url = `https://ollama.com/download/${fileName}`
          const prefix = join(home, '.local')
          const binPath = join(prefix, 'bin', 'ollama')
          const tmpArchive = join(tmpdir(), `ollama-${Date.now()}.${isLinux ? 'tar.zst' : 'tgz'}`)

          mkdirSync(join(prefix, 'bin'), { recursive: true })

          onProgress({ stage: 'downloading', percent: 5, message: 'Descargando Ollama…' })
          await downloadWithProgress(url, tmpArchive, (bytes, total) => {
            const pct = total > 0 ? Math.round((bytes / total) * 85) + 5 : 10
            onProgress({ stage: 'downloading', percent: pct, message: 'Descargando Ollama…' })
          })

          onProgress({ stage: 'installing', percent: 92, message: 'Extrayendo…' })
          try {
            if (isLinux) {
              // zstd-compressed tar. Try GNU tar --zstd, fall back to piping through zstd.
              try {
                execSync(`tar --zstd -xf "${tmpArchive}" -C "${prefix}"`, { stdio: 'ignore' })
              } catch {
                execSync(`zstd -dc "${tmpArchive}" | tar -x -C "${prefix}"`, { stdio: 'ignore', shell: '/bin/bash' })
              }
            } else {
              execSync(`tar -xzf "${tmpArchive}" -C "${prefix}"`, { stdio: 'ignore' })
            }
          } finally {
            try { unlinkSync(tmpArchive) } catch { /* ignore */ }
          }

          // Some macOS archives ship a flat binary instead of bin/ollama — normalize.
          if (!existsSync(binPath)) {
            const flat = join(prefix, 'ollama')
            if (existsSync(flat)) { copyFileSync(flat, binPath); unlinkSync(flat) }
          }
          if (!existsSync(binPath)) throw new Error('No se encontró el binario de Ollama tras la extracción')
          chmodSync(binPath, 0o755)
          knownBinary = binPath
        }

        onProgress({ stage: 'done', percent: 100, message: 'Ollama instalado correctamente' })
      } finally {
        installingNow = false
      }
    },

    async startServer(serverUrl) {
      if (await checkHealth(serverUrl)) return

      const binary = knownBinary ?? findOllamaBinary()
      if (!binary) throw new Error('Ollama no está instalado')
      knownBinary = binary

      // Parse host from URL for OLLAMA_HOST env var
      const host = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const env = { ...process.env, OLLAMA_HOST: host }

      serverProcess = spawn(binary, ['serve'], {
        detached: false,
        stdio: 'ignore',
        env
      })
      managedByUs = true

      // Wait up to 15s for the server to come up (poll every 500ms)
      for (let i = 0; i < 30; i++) {
        await new Promise<void>(r => setTimeout(r, 500))
        if (await checkHealth(serverUrl)) return
      }
      throw new Error('El servidor Ollama no respondió en 15 segundos')
    },

    stopServer() {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill()
        serverProcess = null
      }
      managedByUs = false
    },

    isRunningByUs() {
      return managedByUs && serverProcess !== null && !serverProcess.killed
    },

    async listModels(serverUrl) {
      // Try Ollama-specific endpoint first, fall back to OpenAI-compatible /v1/models
      const ollamaRes = await fetch(`${serverUrl}/api/tags`, { signal: AbortSignal.timeout(3000) }).catch(() => null)
      if (ollamaRes?.ok) {
        const data = await ollamaRes.json() as {
          models?: Array<{ name: string; size: number; modified_at: string }>
        }
        return (data.models ?? []).map(m => ({
          name: m.name,
          size: m.size,
          modifiedAt: m.modified_at
        }))
      }

      // Generic OpenAI-compatible server (LM Studio, Jan, llama.cpp, etc.)
      const openaiRes = await fetch(`${serverUrl}/v1/models`, { signal: AbortSignal.timeout(3000) })
      if (!openaiRes.ok) throw new Error(`Error al listar modelos: HTTP ${openaiRes.status}`)
      const data = await openaiRes.json() as {
        data?: Array<{ id: string }>
      }
      return (data.data ?? []).map(m => ({
        name: m.id,
        size: 0,
        modifiedAt: ''
      }))
    },

    async pullModel(serverUrl, name, onProgress) {
      pullController = new AbortController()
      const { signal } = pullController

      try {
        const res = await fetch(`${serverUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, stream: true }),
          signal
        })
        if (!res.ok) throw new Error(`Error al iniciar descarga: HTTP ${res.status}`)
        if (!res.body) throw new Error('Sin respuesta del servidor')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // Accumulate per-layer totals so we can emit a single unified progress
        const layers = new Map<string, { total: number; completed: number }>()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            const data = JSON.parse(line) as {
              status: string
              digest?: string
              completed?: number
              total?: number
              error?: string
            }
            if (data.error) throw new Error(data.error)

            if (data.digest && data.total) {
              const layer = layers.get(data.digest) ?? { total: data.total, completed: 0 }
              layer.total = data.total
              layer.completed = data.completed ?? layer.completed
              layers.set(data.digest, layer)
            }

            let grandTotal = 0
            let grandCompleted = 0
            for (const l of layers.values()) {
              grandTotal += l.total
              grandCompleted += l.completed
            }

            onProgress({
              model: name,
              status: data.status,
              completed: grandCompleted > 0 ? grandCompleted : data.completed,
              total: grandTotal > 0 ? grandTotal : data.total,
              done: data.status === 'success'
            })
          }
        }
      } finally {
        pullController = null
      }
    },

    cancelPull() {
      pullController?.abort()
      pullController = null
    },

    async deleteModel(serverUrl, name) {
      const res = await fetch(`${serverUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      if (!res.ok) throw new Error(`Error al eliminar modelo: HTTP ${res.status}`)
    },

    // Preloads the model into VRAM by sending an empty request.
    // Call after server starts or after selecting a model so the first real
    // user message doesn't pay the cold-start penalty.
    async warmupModel(serverUrl, modelName) {
      if (!modelName) return
      try {
        const res = await fetch(`${serverUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, prompt: '', stream: false, keep_alive: '1h' }),
          signal: AbortSignal.timeout(120_000) // large models can take ~60s to load
        })
        // Drain the body to release the connection
        if (res.body) await res.body.cancel()
      } catch { /* best-effort — don't throw if server hiccups */ }
    },

    dispose() {
      if (managedByUs && serverProcess && !serverProcess.killed) {
        serverProcess.kill()
      }
    }
  }
}
