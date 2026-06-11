import { useEffect, useState } from 'react'
import type { DbStats, UserSettings } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { SessionSection } from './SessionSection'
import { StartupSection } from './StartupSection'
import { DbStatsSection } from './DbStatsSection'
import { LocalFolderSection } from './LocalFolderSection'
import { AiConfigSection } from './AiConfigSection'

interface SettingsProps {
  onLogout: () => void
}

export function Settings({ onLogout }: SettingsProps) {
  const { settingsRepository } = useDependencies()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [stats, setStats] = useState<DbStats | null>(null)

  useEffect(() => {
    void settingsRepository.getSettings().then(setSettings)
    void settingsRepository.getDbStats().then(setStats)
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
          <SessionSection onLogout={onLogout} />
          <StartupSection settings={settings} onSettingsChange={setSettings} />
          <DbStatsSection stats={stats} />
          <LocalFolderSection settings={settings} />
        </div>
      </div>
    </div>
  )
}
