import { createContext, useContext } from 'react'
import type { IMessageRepository } from '../ports/IMessageRepository'
import type { IConnectionService } from '../ports/IConnectionService'
import type { ISearchService } from '../ports/ISearchService'
import type { IAiService } from '../ports/IAiService'
import type { ISettingsRepository } from '../ports/ISettingsRepository'
import type { IExportService } from '../ports/IExportService'
import type { IOllamaService } from '../ports/IOllamaService'

import { IpcMessageRepository } from './IpcMessageRepository'
import { IpcConnectionService } from './IpcConnectionService'
import { IpcSearchService } from './IpcSearchService'
import { IpcAiService } from './IpcAiService'
import { IpcSettingsRepository } from './IpcSettingsRepository'
import { IpcExportService } from './IpcExportService'
import { IpcOllamaService } from './IpcOllamaService'

export interface Dependencies {
  messageRepository: IMessageRepository
  connectionService: IConnectionService
  searchService: ISearchService
  aiService: IAiService
  settingsRepository: ISettingsRepository
  exportService: IExportService
  ollamaService: IOllamaService
}

const defaultDependencies: Dependencies = {
  messageRepository: new IpcMessageRepository(),
  connectionService: new IpcConnectionService(),
  searchService: new IpcSearchService(),
  aiService: new IpcAiService(),
  settingsRepository: new IpcSettingsRepository(),
  exportService: new IpcExportService(),
  ollamaService: new IpcOllamaService()
}

const DependenciesContext = createContext<Dependencies>(defaultDependencies)

export const DependenciesProvider = DependenciesContext.Provider

export function useDependencies(): Dependencies {
  return useContext(DependenciesContext)
}
