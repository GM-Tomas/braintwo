import { describe, expect, it, vi } from 'vitest'
import { readSettings, writeSettings } from './settings'

describe('settings service', () => {
  it('reads autostart and userData path', () => {
    const app = {
      getLoginItemSettings: () => ({ openAtLogin: true }),
      getPath: () => 'C:\\data'
    }
    expect(readSettings(app as never)).toEqual({
      autostart: true,
      userDataPath: 'C:\\data'
    })
  })

  it('writes autostart through Electron login item settings', () => {
    const setLoginItemSettings = vi.fn()
    const app = {
      getLoginItemSettings: () => ({ openAtLogin: false }),
      getPath: () => 'C:\\data',
      setLoginItemSettings
    }
    writeSettings(app as never, { autostart: true })
    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      openAsHidden: true,
      args: ['--hidden']
    })
  })
})
