import { useEffect, useState } from 'react'
import type { UserSettings } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { SessionSection } from './SessionSection'
import { LocalFolderSection } from './LocalFolderSection'
import { AiConfigSection } from './AiConfigSection'
import { AppearanceSection } from './AppearanceSection'

interface SettingsProps {
  onLogout: () => void
  textSize: UserSettings['textSize']
  onTextSizeChange: (size: UserSettings['textSize']) => void
}

export function Settings({ onLogout, textSize, onTextSizeChange }: SettingsProps) {
  const { settingsRepository } = useDependencies()
  const [settings, setSettings] = useState<UserSettings | null>(null)

  useEffect(() => {
    void settingsRepository.getSettings().then(setSettings)
  }, [settingsRepository])

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Ajustes"
        title="Ajustes"
        subtitle="Estado local, base de datos y controles de sincronizacion."
      />

      <div className="flex-1 overflow-y-auto px-14 py-8">
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <AiConfigSection />
          <AppearanceSection
            textSize={textSize}
            onTextSizeChange={onTextSizeChange}
            onSettingsChange={setSettings}
          />
          <SessionSection
            settings={settings}
            onSettingsChange={setSettings}
            onLogout={onLogout}
          />
          <LocalFolderSection settings={settings} />
        </div>
      </div>
    </div>
  )
}
