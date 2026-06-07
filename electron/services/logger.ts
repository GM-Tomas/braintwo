import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, statSync, renameSync } from 'node:fs'
import pino from 'pino'

const LOG_CAP_BYTES = 10 * 1024 * 1024 // 10MB
let centralLogger: pino.Logger | null = null
let logFilePath: string | null = null

export function initLogger(userDataPath: string): void {
  const logDir = join(userDataPath, 'logs')
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  logFilePath = join(logDir, 'app-logs.json')

  try {
    if (existsSync(logFilePath) && statSync(logFilePath).size > LOG_CAP_BYTES) {
      const rotatedPath = join(logDir, `app-logs.${Date.now()}.json`)
      renameSync(logFilePath, rotatedPath)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to rotate log file:', err)
  }

  centralLogger = pino(
    {
      level: 'info',
      timestamp: () => `,"time":"${new Date().toISOString()}"`
    },
    pino.destination({ dest: logFilePath, sync: true })
  )
}

export function getLogFilePath(): string {
  if (!logFilePath) {
    const userData = app?.getPath('userData') || process.env.APPDATA || '.'
    return join(userData, 'logs', 'app-logs.json')
  }
  return logFilePath
}

export function getCentralLogger(): pino.Logger {
  if (!centralLogger) {
    return pino({ level: 'info' })
  }
  return centralLogger
}

export function logInfo(module: string, message: string, meta?: Record<string, unknown>): void {
  const logger = getCentralLogger().child({ module, ...meta })
  logger.info(message)
}

export function logError(module: string, error: unknown, message?: string, meta?: Record<string, unknown>): void {
  const errObj = error instanceof Error ? {
    message: error.message,
    name: error.name,
    stack: error.stack
  } : typeof error === 'string' ? { message: error } : { message: String(error) }

  const logger = getCentralLogger().child({ module, error: errObj, ...meta })
  logger.error(message || errObj.message || 'An error occurred')
}
