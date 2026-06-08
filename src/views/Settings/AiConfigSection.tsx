import { useEffect, useState } from 'react'
import type { AiConfig, AiProvider, AiConfigProfile } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { Icon } from '@/lib/icons'
import { LocalAiSection } from './LocalAiSection'

export function AiConfigSection() {
  const { aiService } = useDependencies()
  const [profiles, setProfiles] = useState<AiConfigProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [aiDraft, setAiDraft] = useState<Partial<AiConfigProfile>>({})
  const [ollamaCfg, setOllamaCfg] = useState({
    activeModel: '',
    serverUrl: 'http://localhost:11434',
    autoStart: true,
    enabled: false,
    mode: 'ollama' as 'ollama' | 'manual'
  })

  useEffect(() => {
    void aiService.getConfig().then((cfg) => {
      if (cfg) {
        const loadedProfiles = cfg.profiles ?? []
        let currentActiveId = cfg.activeProfileId ?? ''

        // Migrate from old single profile config if no profiles exist
        if (loadedProfiles.length === 0) {
          const defaultId = 'profile-default'
          const defaultName = cfg.provider
            ? `Perfil ${cfg.provider === 'anthropic' ? 'Anthropic' : cfg.provider === 'gemini' ? 'Gemini' : cfg.provider === 'deepseek' ? 'DeepSeek' : cfg.provider === 'opencode-zen' ? 'OpenCode' : 'Otro'}`
            : 'Perfil 1'
          
          const providers = cfg.providers ?? {}
          if (cfg.provider && !providers[cfg.provider]) {
            providers[cfg.provider] = {
              apiKey: cfg.apiKey ?? '',
              baseUrl: cfg.baseUrl ?? '',
              model: cfg.model ?? ''
            }
          }

          const initialProfile: AiConfigProfile = {
            id: defaultId,
            name: defaultName,
            provider: cfg.provider ?? 'openai-compat',
            apiKey: cfg.apiKey ?? '',
            baseUrl: cfg.baseUrl ?? '',
            model: cfg.model ?? '',
            providers
          }
          setProfiles([initialProfile])
          setActiveProfileId(defaultId)
          setAiDraft(initialProfile)
        } else {
          setProfiles(loadedProfiles)
          // 'local' is a valid activeProfileId even though it's not in the profiles array
          if (currentActiveId !== 'local' && (!currentActiveId || !loadedProfiles.some(p => p.id === currentActiveId))) {
            currentActiveId = loadedProfiles[0]!.id
          }
          setActiveProfileId(currentActiveId)
          if (currentActiveId !== 'local') {
            const activeProfile = loadedProfiles.find(p => p.id === currentActiveId)!
            setAiDraft(activeProfile)
          }
        }
        const o = cfg.ollama
        setOllamaCfg({
          activeModel: o?.activeModel ?? '',
          serverUrl: o?.serverUrl ?? 'http://localhost:11434',
          autoStart: o?.autoStart ?? true,
          enabled: o?.enabled ?? false,
          mode: o?.mode ?? 'ollama'
        })
      } else {
        const defaultId = 'profile-default'
        const initialProfile: AiConfigProfile = {
          id: defaultId,
          name: 'BigPickle',
          provider: 'opencode-zen',
          apiKey: 'public',
          baseUrl: 'https://opencode.ai/zen/v1',
          model: 'big-pickle',
          providers: {
            'opencode-zen': { apiKey: 'public', baseUrl: 'https://opencode.ai/zen/v1', model: 'big-pickle' }
          }
        }
        setProfiles([initialProfile])
        setActiveProfileId(defaultId)
        setAiDraft(initialProfile)
        // Persist immediately so the service is ready from first launch
        void aiService.setConfig({
          provider: initialProfile.provider,
          apiKey: initialProfile.apiKey,
          baseUrl: initialProfile.baseUrl,
          model: initialProfile.model,
          providers: initialProfile.providers,
          activeProfileId: defaultId,
          profiles: [initialProfile]
        })
      }
    })
  }, [aiService])

  const handleLocalSelect = () => {
    setActiveProfileId('local')
    void aiService.setConfig({
      provider: 'ollama',
      apiKey: '',
      model: ollamaCfg.activeModel,
      activeProfileId: 'local',
      profiles,
      ollama: { ...ollamaCfg, enabled: true }
    })
  }

  const handleOllamaModelChange = (model: string) => {
    const next = { ...ollamaCfg, activeModel: model }
    setOllamaCfg(next)
    void aiService.setConfig({ model, ollama: next, profiles })
  }

  const handleOllamaServerUrlChange = (serverUrl: string) => {
    const next = { ...ollamaCfg, serverUrl }
    setOllamaCfg(next)
    void aiService.setConfig({ ollama: next, profiles })
  }

  const handleOllamaAutoStartChange = (autoStart: boolean) => {
    const next = { ...ollamaCfg, autoStart }
    setOllamaCfg(next)
    void aiService.setConfig({ ollama: next, profiles })
  }


  const handleProfileSelect = (profileId: string) => {
    const selected = profiles.find((p) => p.id === profileId)
    if (!selected) return

    setActiveProfileId(profileId)
    setAiDraft(selected)

    // Persist active selection instantly to the main config so background services pick it up
    const updatedConfig: AiConfig = {
      provider: selected.provider,
      apiKey: selected.apiKey,
      baseUrl: selected.baseUrl,
      model: selected.model,
      providers: selected.providers,
      activeProfileId: profileId,
      profiles: profiles
    }
    void aiService.setConfig(updatedConfig)
  }

  const updateAndSave = (patch: Partial<AiConfigProfile>) => {
    setAiDraft((prev) => {
      const nextDraft = { ...prev, ...patch }
      
      setProfiles((prevProfiles) => {
        const nextProfiles = prevProfiles.map((p) => {
          if (p.id === activeProfileId) {
            return {
              ...p,
              ...patch
            }
          }
          return p
        })

        // Save immediately
        const updatedConfig: AiConfig = {
          provider: nextDraft.provider ?? 'openai-compat',
          apiKey: nextDraft.apiKey ?? '',
          baseUrl: nextDraft.baseUrl ?? '',
          model: nextDraft.model ?? '',
          providers: nextDraft.providers ?? {},
          activeProfileId: activeProfileId,
          profiles: nextProfiles
        }
        void aiService.setConfig(updatedConfig)

        return nextProfiles
      })

      return nextDraft
    })
  }

  const createNewProfile = () => {
    const nextNumber = profiles.length + 1
    const newId = `profile-${Date.now()}`
    const newProfile: AiConfigProfile = {
      id: newId,
      name: `Perfil ${nextNumber}`,
      provider: 'openai-compat',
      apiKey: '',
      baseUrl: '',
      model: '',
      providers: {}
    }

    const updatedProfiles = [...profiles, newProfile]
    setProfiles(updatedProfiles)
    setActiveProfileId(newId)
    setAiDraft(newProfile)

    const updatedConfig: AiConfig = {
      provider: newProfile.provider,
      apiKey: newProfile.apiKey,
      baseUrl: newProfile.baseUrl,
      model: newProfile.model,
      providers: newProfile.providers,
      activeProfileId: newId,
      profiles: updatedProfiles
    }
    void aiService.setConfig(updatedConfig)
  }

  const deleteCurrentProfile = () => {
    if (profiles.length <= 1) return
    const currentProfile = profiles.find((p) => p.id === activeProfileId)
    if (!currentProfile) return

    const ok = confirm(`¿Estás seguro de que querés eliminar el perfil "${currentProfile.name}"?`)
    if (!ok) return

    const updatedProfiles = profiles.filter((p) => p.id !== activeProfileId)
    const nextActiveProfile = updatedProfiles[0]!
    const nextActiveId = nextActiveProfile.id

    setProfiles(updatedProfiles)
    setActiveProfileId(nextActiveId)
    setAiDraft(nextActiveProfile)

    const updatedConfig: AiConfig = {
      provider: nextActiveProfile.provider,
      apiKey: nextActiveProfile.apiKey,
      baseUrl: nextActiveProfile.baseUrl,
      model: nextActiveProfile.model,
      providers: nextActiveProfile.providers,
      activeProfileId: nextActiveId,
      profiles: updatedProfiles
    }
    void aiService.setConfig(updatedConfig)
  }

  const handleProfileNameChange = (newName: string) => {
    updateAndSave({ name: newName })
  }

  const handleProviderChange = (newProvider: AiProvider) => {
    setAiDraft((prev) => {
      const providers = prev.providers ?? {}
      const savedForProvider = providers[newProvider] ?? { apiKey: '', baseUrl: '', model: '' }
      
      const patch: Partial<AiConfigProfile> = {
        provider: newProvider,
        apiKey: savedForProvider.apiKey ?? '',
        baseUrl: savedForProvider.baseUrl ?? '',
        model: savedForProvider.model ?? '',
        providers: {
          ...providers,
          [newProvider]: savedForProvider
        }
      }

      const nextDraft = { ...prev, ...patch }

      setProfiles((prevProfiles) => {
        const nextProfiles = prevProfiles.map((p) => {
          if (p.id === activeProfileId) {
            return {
              ...p,
              ...patch
            }
          }
          return p
        })

        const updatedConfig: AiConfig = {
          provider: nextDraft.provider ?? 'openai-compat',
          apiKey: nextDraft.apiKey ?? '',
          baseUrl: nextDraft.baseUrl ?? '',
          model: nextDraft.model ?? '',
          providers: nextDraft.providers ?? {},
          activeProfileId: activeProfileId,
          profiles: nextProfiles
        }
        void aiService.setConfig(updatedConfig)

        return nextProfiles
      })

      return nextDraft
    })
  }

  const handleFieldChange = (field: 'apiKey' | 'baseUrl' | 'model', value: string) => {
    setAiDraft((prev) => {
      const currentProvider = prev.provider
      if (!currentProvider) {
        const patch = { [field]: value }
        const nextDraft = { ...prev, ...patch }
        
        setProfiles((prevProfiles) => {
          const nextProfiles = prevProfiles.map((p) => {
            if (p.id === activeProfileId) return { ...p, ...patch }
            return p
          })
          const updatedConfig: AiConfig = {
            provider: nextDraft.provider ?? 'openai-compat',
            apiKey: nextDraft.apiKey ?? '',
            baseUrl: nextDraft.baseUrl ?? '',
            model: nextDraft.model ?? '',
            providers: nextDraft.providers ?? {},
            activeProfileId: activeProfileId,
            profiles: nextProfiles
          }
          void aiService.setConfig(updatedConfig)
          return nextProfiles
        })
        return nextDraft
      }

      const providers = prev.providers ?? {}
      const providerConfig = providers[currentProvider] ?? { apiKey: '', baseUrl: '', model: '' }
      const updatedProviderConfig = {
        ...providerConfig,
        [field]: value
      }

      const patch: Partial<AiConfigProfile> = {
        [field]: value,
        providers: {
          ...providers,
          [currentProvider]: updatedProviderConfig
        }
      }

      const nextDraft = { ...prev, ...patch }

      setProfiles((prevProfiles) => {
        const nextProfiles = prevProfiles.map((p) => {
          if (p.id === activeProfileId) return { ...p, ...patch }
          return p
        })
        const updatedConfig: AiConfig = {
          provider: nextDraft.provider ?? 'openai-compat',
          apiKey: nextDraft.apiKey ?? '',
          baseUrl: nextDraft.baseUrl ?? '',
          model: nextDraft.model ?? '',
          providers: nextDraft.providers ?? {},
          activeProfileId: activeProfileId,
          profiles: nextProfiles
        }
        void aiService.setConfig(updatedConfig)
        return nextProfiles
      })

      return nextDraft
    })
  }

  const modelPlaceholder =
    aiDraft.provider === 'anthropic'
      ? 'claude-haiku-4-5'
      : aiDraft.provider === 'gemini'
        ? 'gemini-2.0-flash'
        : aiDraft.provider === 'deepseek'
          ? 'deepseek-v4-pro'
          : aiDraft.provider === 'opencode-zen'
            ? 'big-pickle'
            : 'gpt-4o-mini'

  const baseUrlPlaceholder =
    aiDraft.provider === 'deepseek'
      ? 'https://api.deepseek.com'
      : aiDraft.provider === 'opencode-zen'
        ? 'https://opencode.ai/zen/v1'
        : 'http://localhost:11434/v1'

  return (
    <section className="col-span-full rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-bt-text">Asistente IA</h2>
        <p className="mt-1 text-[12px] text-bt-muted">
          Configurá tus perfiles de proveedores para el Chat IA. Las claves se guardan localmente.
        </p>
      </div>

      {/* Profile selector tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-bt-border pb-4">
        {profiles.map((p) => {
          const isActive = p.id === activeProfileId
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] text-[13px] font-medium transition-all cursor-pointer border ${
                isActive
                  ? 'bg-bt-hover text-bt-text border-bt-border shadow-bt-nav-active'
                  : 'bg-bt-bg text-bt-muted border-transparent hover:bg-bt-hover/60 hover:text-bt-text'
              }`}
              onClick={() => handleProfileSelect(p.id)}
            >
              <span>{p.name}</span>
              {isActive && profiles.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteCurrentProfile()
                  }}
                  title="Eliminar perfil"
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-bt-border hover:text-bt-red transition-colors"
                >
                  <Icon name="x" size={10} />
                </button>
              )}
            </div>
          )
        })}
        {/* Fixed Local tab */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] text-[13px] font-medium transition-all cursor-pointer border ${
            activeProfileId === 'local'
              ? 'bg-bt-hover text-bt-text border-bt-border shadow-bt-nav-active'
              : 'bg-bt-bg text-bt-muted border-transparent hover:bg-bt-hover/60 hover:text-bt-text'
          }`}
          onClick={handleLocalSelect}
        >
          <Icon name="cpu" size={12} className="shrink-0" />
          <span>Local</span>
          {ollamaCfg.enabled && (
            <span className="h-1.5 w-1.5 rounded-full bg-bt-green" />
          )}
        </div>


        {/* Add Profile Pill */}
        <button
          type="button"
          onClick={createNewProfile}
          className="flex items-center gap-1 px-3 py-1.5 rounded-[20px] text-[13px] font-medium bg-bt-bg text-bt-primary hover:bg-bt-hover border border-dashed border-bt-primary/40 hover:border-bt-primary transition-all"
        >
          <Icon name="plus" size={12} className="shrink-0" />
          <span>Nuevo perfil</span>
        </button>
      </div>

      {activeProfileId === 'local' ? (
        <div className="mt-4">
          <LocalAiSection
            activeModel={ollamaCfg.activeModel}
            serverUrl={ollamaCfg.serverUrl}
            autoStart={ollamaCfg.autoStart}
            ollamaMode={ollamaCfg.mode}
            onModelChange={handleOllamaModelChange}
            onServerUrlChange={handleOllamaServerUrlChange}
            onAutoStartChange={handleOllamaAutoStartChange}
            onModeChange={(mode) => {
              const next = {
                ...ollamaCfg,
                mode,
                ...(mode === 'ollama' ? { serverUrl: 'http://localhost:11434' } : {})
              }
              setOllamaCfg(next)
              void aiService.setConfig({ ollama: next, profiles })
            }}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Nombre del Perfil</span>
            <input
              type="text"
              value={aiDraft.name ?? ''}
              onChange={(e) => handleProfileNameChange(e.target.value)}
              placeholder="Ej: OpenAI Rápido, Claude..."
              className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Proveedor</span>
            <select
              value={aiDraft.provider ?? ''}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
              className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text outline-none focus:border-bt-primary/50"
            >
              <option value="">Seleccionar…</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
              <option value="deepseek">DeepSeek</option>
              <option value="opencode-zen">OpenCode Zen</option>
              <option value="openai-compat">Otro (OpenAI-compatible)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Modelo</span>
            <input
              type="text"
              value={aiDraft.model ?? ''}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              placeholder={modelPlaceholder}
              className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">API Key</span>
            <input
              type="password"
              value={aiDraft.apiKey ?? ''}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder={
                aiDraft.provider === 'deepseek'
                  ? 'sk-…'
                  : aiDraft.provider === 'opencode-zen'
                    ? 'Tu API Key de Zen…'
                    : 'sk-… / AIza… / gsk_…'
              }
              autoComplete="off"
              className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
            />
          </label>

          {['openai-compat', 'deepseek', 'opencode-zen'].includes(aiDraft.provider ?? '') && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">
                Base URL {aiDraft.provider !== 'openai-compat' && '(Opcional)'}
              </span>
              <input
                type="url"
                value={aiDraft.baseUrl ?? ''}
                onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                placeholder={baseUrlPlaceholder}
                className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
              />
            </label>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-[12px] text-bt-dim">
        <span className="h-1.5 w-1.5 rounded-full bg-bt-accent animate-pulse" />
        <span>Los cambios se guardan automáticamente.</span>
      </div>
    </section>
  )
}
