import type { AppContext } from '../app-context'
import { AppIpcController } from './AppIpcController'
import { SettingsIpcController } from './SettingsIpcController'
import { SearchIpcController } from './SearchIpcController'
import { AiIpcController } from './AiIpcController'
import { WaIpcController } from './WaIpcController'
import { ExportIpcController } from './ExportIpcController'
import { LogsIpcController } from './LogsIpcController'
import { OllamaIpcController } from './OllamaIpcController'

export function registerAllHandlers(context: AppContext) {
  AppIpcController.register(context)
  SettingsIpcController.register(context)
  SearchIpcController.register(context)
  AiIpcController.register(context)
  WaIpcController.register(context)
  ExportIpcController.register(context)
  LogsIpcController.register()
  OllamaIpcController.register(context)
}
