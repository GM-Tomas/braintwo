import { ipcMain } from 'electron'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { AppContext } from '../app-context'
import { SqliteMessageRepository } from '../repositories/SqliteMessageRepository'
import { processImageMessage } from '../services/image-ingest'
import { extractText, type WAMessageLike } from '../services/ingest'
import { readAiConfig } from '../services/ai-config'
import { isAiConfigured } from '../services/ai-provider'
import { generateDashboardReport } from '../services/dashboard-report'
import { logError } from '../services/logger'
import type { DashboardReportResult } from '@shared/types'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
const REMINDER_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000
const MAX_REPORT_MESSAGES = 500
const MAX_REMINDER_CANDIDATES = 100

export class AppIpcController {
  static register(context: AppContext) {
    // Lazy instance: we wrap it in a getter or instantiate inside handlers where context.ingest.value is guaranteed
    const getMessageRepo = () => {
      if (!context.ingest.value) throw new Error('Ingest pipeline not ready')
      return new SqliteMessageRepository(context.ingest.value)
    }

    ipcMain.handle('app:open-window', () => {
      context.showWindow()
    })

    ipcMain.handle('app:quit', () => {
      context.isQuitting.value = true
      context.app.quit()
    })

    ipcMain.handle('app:get-version', () => {
      return context.app.getVersion()
    })

    ipcMain.handle('app:get-platform', () => {
      return process.platform
    })

    ipcMain.handle('app:get-message-count', () => {
      if (!context.ingest.value) return 0
      return getMessageRepo().getMessageCount()
    })

    ipcMain.handle('app:get-recent-messages', (_e, limit: number) => {
      if (!context.ingest.value) return []
      return getMessageRepo().getRecentMessages(Math.max(0, Math.min(limit, 500)) || 50)
    })

    ipcMain.handle('app:get-message-by-id', (_e, id: number) => {
      if (!context.ingest.value) return null
      return getMessageRepo().getMessageById(id)
    })

    // Generates an AI summary of WhatsApp activity from the last 3 days.
    ipcMain.handle('app:generate-dashboard-report', async (): Promise<DashboardReportResult> => {
      if (!context.ingest.value) return { ok: false, reason: 'error' }

      const config = readAiConfig(context.app.getPath('userData'))
      if (!isAiConfigured(config)) return { ok: false, reason: 'not-configured' }

      const messages = getMessageRepo().getMessagesSince(Date.now() - THREE_DAYS_MS, MAX_REPORT_MESSAGES)
      if (messages.length === 0) return { ok: false, reason: 'no-messages' }

      const reminderCandidates = getMessageRepo().getReminderCandidates(
        Date.now() - REMINDER_LOOKBACK_MS,
        MAX_REMINDER_CANDIDATES
      )

      try {
        const report = await generateDashboardReport(config, messages, reminderCandidates)
        return { ok: true, report }
      } catch (err) {
        logError('ipc:generate-dashboard-report', err, 'Failed to generate dashboard report')
        return { ok: false, reason: 'error' }
      }
    })

    ipcMain.handle('app:get-sync-status', () => {
      return context.syncStatus.get()
    })

    ipcMain.handle('app:set-title-bar-overlay', (_e, opts: { color: string; symbolColor: string }) => {
      if (!context.mainWindow.value || context.mainWindow.value.isDestroyed()) return
      context.mainWindow.value.setTitleBarOverlay({ ...opts, height: 36 })
    })

    ipcMain.handle('ignore:toggle', (_e, msgId: number) => {
      if (!context.ingest.value) return false
      return getMessageRepo().toggleIgnored(msgId)
    })

    ipcMain.handle('ignore:get-ids', () => {
      if (!context.ingest.value) return []
      return getMessageRepo().getIgnoredIds()
    })

    // Returns a stored image as a base64 data URL, or null if unavailable.
    ipcMain.handle('media:read-image', (_e, msgId: number): string | null => {
      if (!context.ingest.value) return null
      const msg = getMessageRepo().getMessageById(msgId)
      const filePath = msg?.media?.imageLocalPath
      if (!filePath) return null
      // Guard against path traversal: only serve files inside the images dir.
      const imagesDir = resolve(join(context.app.getPath('userData'), 'media', 'images'))
      if (!resolve(filePath).startsWith(imagesDir)) return null
      try {
        const buf = readFileSync(filePath)
        const mime = msg?.media?.mimetype || 'image/jpeg'
        return `data:${mime};base64,${buf.toString('base64')}`
      } catch {
        return null
      }
    })

    // Re-downloads (and, if AI is configured, re-describes) an image from its
    // stored raw WhatsApp message. Used for images received before the image
    // store existed, or to retry a failed description.
    ipcMain.handle('media:reprocess-image', async (_e, msgId: number): Promise<boolean> => {
      if (!context.ingest.value || !context.whatsapp.value || !context.db.value) return false
      const msg = getMessageRepo().getMessageById(msgId)
      if (!msg || msg.kind !== 'image') return false

      const rawJson = context.db.value.getRawJson(msgId)
      if (!rawJson) return false
      let raw: WAMessageLike
      try {
        raw = JSON.parse(rawJson) as WAMessageLike
      } catch {
        return false
      }

      try {
        await processImageMessage(
          {
            whatsapp: context.whatsapp.value,
            db: context.db.value,
            contextSvc: context.contextSvc.value,
            userDataPath: context.app.getPath('userData'),
            getAiConfig: () => readAiConfig(context.app.getPath('userData'))
          },
          raw,
          msgId,
          msg.media,
          msg.timestamp,
          extractText(raw)
        )
        return true
      } catch {
        return false
      }
    })
  }
}
