import { createContext, useContext } from 'react'

/** A guard returns true to allow navigation, false to block it. */
export type ExitGuard = () => boolean

export interface NavigationGuard {
  /** Register (or clear with null) the active exit guard. */
  registerGuard: (fn: ExitGuard | null) => void
}

export const NavigationGuardContext = createContext<NavigationGuard | null>(null)

export function useNavigationGuard(): NavigationGuard {
  const ctx = useContext(NavigationGuardContext)
  if (!ctx) throw new Error('useNavigationGuard must be used within NavigationGuardContext.Provider')
  return ctx
}
