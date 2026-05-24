import type { ImportProgress, Unsubscribe } from '@shared/types'

export interface IExportService {
  importTxt(): Promise<ImportProgress>
  onProgress(cb: (progress: ImportProgress) => void): Unsubscribe
}
