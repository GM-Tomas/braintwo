import { describe, it, expect, vi } from 'vitest'
import { sep } from 'node:path'
import {
  statusLabel,
  buildResourcePath,
  pickTrayIconName,
  buildTrayMenuTemplate
} from './main-helpers'

describe('main-helpers', () => {
  describe('statusLabel', () => {
    it.each([
      ['connecting', 'Conectando…'],
      ['open', 'Conectado'],
      ['disconnected', 'Reconectando…'],
      ['logged-out', 'Sesión cerrada']
    ] as const)('maps %s → %s', (state, expected) => {
      expect(statusLabel(state)).toBe(expected)
    })
  })

  describe('buildResourcePath', () => {
    it('uses resourcesPath/build when packaged', () => {
      const result = buildResourcePath(
        { isPackaged: true, resourcesPath: '/app/resources', dirname: '/whatever' },
        'tray-icon.png'
      )
      expect(result).toBe(['', 'app', 'resources', 'build', 'tray-icon.png'].join(sep))
    })

    it('walks up from dirname/../../build when in dev (path.join collapses ..)', () => {
      const result = buildResourcePath(
        { isPackaged: false, resourcesPath: '/ignored', dirname: '/proj/out/main' },
        'icon-256.png'
      )
      // path.join('/proj/out/main', '..', '..', 'build', 'icon-256.png') → /proj/build/icon-256.png
      expect(result).toBe(['', 'proj', 'build', 'icon-256.png'].join(sep))
    })

    it('does not consult resourcesPath when not packaged', () => {
      const result = buildResourcePath(
        { isPackaged: false, resourcesPath: '/never/used', dirname: '/d' },
        'x.png'
      )
      expect(result).not.toContain('never')
    })

    it('joins multiple segments', () => {
      const result = buildResourcePath(
        { isPackaged: true, resourcesPath: '/r', dirname: '/d' },
        'sub',
        'icon.png'
      )
      expect(result.replace(/\\/g, '/')).toContain('build/sub/icon.png')
    })

    it('works with no extra segments (returns build dir)', () => {
      const result = buildResourcePath({
        isPackaged: true,
        resourcesPath: '/r',
        dirname: '/d'
      })
      expect(result.replace(/\\/g, '/')).toBe('/r/build')
    })
  })

  describe('pickTrayIconName', () => {
    it('returns @1x for darwin (template-icon style)', () => {
      expect(pickTrayIconName('darwin')).toBe('tray-icon.png')
    })

    it.each(['win32', 'linux', 'freebsd', 'aix'] as NodeJS.Platform[])(
      'returns @2x on %s',
      (p) => {
        expect(pickTrayIconName(p)).toBe('tray-icon@2x.png')
      }
    )
  })

  describe('buildTrayMenuTemplate', () => {
    it('produces 4-item menu (Abrir / Estado / sep / Salir)', () => {
      const onOpen = vi.fn()
      const onQuit = vi.fn()
      const tpl = buildTrayMenuTemplate('Listo', { onOpen, onQuit })
      expect(tpl).toHaveLength(4)
      expect(tpl[0]!.label).toBe('Abrir BrainTwo')
      expect(tpl[1]!.label).toBe('Estado: Listo')
      expect(tpl[1]!.enabled).toBe(false)
      expect(tpl[2]!.type).toBe('separator')
      expect(tpl[3]!.label).toBe('Salir')
    })

    it('Abrir click invokes onOpen, Salir click invokes onQuit', () => {
      const onOpen = vi.fn()
      const onQuit = vi.fn()
      const tpl = buildTrayMenuTemplate('x', { onOpen, onQuit })
      // Electron's MenuItemConstructorOptions click signature accepts mouse-event args;
      // we just call with no args.
      ;(tpl[0]!.click as () => void)()
      ;(tpl[3]!.click as () => void)()
      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onQuit).toHaveBeenCalledTimes(1)
    })

    it('status label is interpolated verbatim', () => {
      const tpl = buildTrayMenuTemplate('Conectando…', {
        onOpen: () => {},
        onQuit: () => {}
      })
      expect(tpl[1]!.label).toBe('Estado: Conectando…')
    })
  })
})
