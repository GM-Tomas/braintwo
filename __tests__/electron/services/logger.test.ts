import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('electron', () => ({
  app: {
    getPath: () => process.env.APPDATA || tmpdir()
  }
}))

const { initLogger, logInfo, logError, getCentralLogger, getLogFilePath } =
  await import('../../../electron/services/logger')

describe('logger service', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bt-logger-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe('initLogger', () => {
    it('creates the logs subdirectory under userData', () => {
      initLogger(dir)
      expect(existsSync(join(dir, 'logs'))).toBe(true)
    })

    it('writes logs to logs/app-logs.json', () => {
      initLogger(dir)
      logInfo('test', 'hello world')
      const filePath = join(dir, 'logs', 'app-logs.json')
      expect(existsSync(filePath)).toBe(true)
      const content = readFileSync(filePath, 'utf8')
      expect(content).toContain('hello world')
      expect(content).toContain('"module":"test"')
    })

    it('rotates the log file when it exceeds 10MB', () => {
      const logDir = join(dir, 'logs')
      // pre-create a large log file
      const big = Buffer.alloc(11 * 1024 * 1024, 'x')
      mkdirOrIgnore(logDir)
      const filePath = join(logDir, 'app-logs.json')
      writeFileSync(filePath, big)

      initLogger(dir)

      // After init: the original file should have been renamed and a fresh one will be created on first write
      const rotated = readdirInDir(logDir).filter((n) => n.startsWith('app-logs.') && n.endsWith('.json') && n !== 'app-logs.json')
      expect(rotated.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('logInfo / logError', () => {
    beforeEach(() => initLogger(dir))

    it('logInfo writes structured fields including meta', () => {
      logInfo('mymod', 'something happened', { userId: 42 })
      const content = readFileSync(join(dir, 'logs', 'app-logs.json'), 'utf8')
      expect(content).toContain('"module":"mymod"')
      expect(content).toContain('"userId":42')
      expect(content).toContain('something happened')
    })

    it('logError serialises Error instances with name + message + stack', () => {
      logError('mymod', new Error('boom'), 'failed to do thing')
      const content = readFileSync(join(dir, 'logs', 'app-logs.json'), 'utf8')
      expect(content).toContain('"name":"Error"')
      expect(content).toContain('"message":"boom"')
      expect(content).toContain('failed to do thing')
    })

    it('logError handles non-Error strings', () => {
      logError('mymod', 'plain string failure')
      const content = readFileSync(join(dir, 'logs', 'app-logs.json'), 'utf8')
      expect(content).toContain('"message":"plain string failure"')
    })

    it('logError handles non-Error non-string values', () => {
      logError('mymod', { code: 42 })
      const content = readFileSync(join(dir, 'logs', 'app-logs.json'), 'utf8')
      expect(content).toContain('[object Object]')
    })
  })

  describe('getCentralLogger / getLogFilePath', () => {
    it('returns a fallback logger before initLogger is called', () => {
      const logger = getCentralLogger()
      expect(logger).toBeDefined()
      expect(typeof logger.info).toBe('function')
    })

    it('getLogFilePath returns a sane path even before init', () => {
      const p = getLogFilePath()
      expect(p.endsWith('app-logs.json')).toBe(true)
    })

    it('after initLogger, getLogFilePath returns the configured path', () => {
      initLogger(dir)
      expect(getLogFilePath()).toBe(join(dir, 'logs', 'app-logs.json'))
    })
  })
})

function mkdirOrIgnore(p: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').mkdirSync(p, { recursive: true })
  } catch {
    /* ignore */
  }
}

function readdirInDir(p: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:fs').readdirSync(p)
}
