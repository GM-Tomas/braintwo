import type { IExportService } from '../ports/IExportService'
import type { ImportProgress, Unsubscribe } from '@shared/types'

export class IpcExportService implements IExportService {
  async importTxt(): Promise<ImportProgress> {
    return window.braintwo.export.importTxt()
  }

  onProgress(cb: (progress: ImportProgress) => void): Unsubscribe {
    return window.braintwo.export.onProgress(cb)
  }
}
