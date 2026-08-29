import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type EnergyUnit = 'kcal' | 'kJ'
export type Theme = 'system' | 'light' | 'dark'

const ENERGY_KEY = 'bodybuddy:energy'
const THEME_KEY = 'bodybuddy:theme'
const KJ_PER_KCAL = 4.184

function detectEnergy(): EnergyUnit {
  try {
    const s = localStorage.getItem(ENERGY_KEY)
    if (s === 'kcal' || s === 'kJ') return s
  } catch {
    // ignore
  }
  return 'kcal'
}

function detectTheme(): Theme {
  try {
    const s = localStorage.getItem(THEME_KEY)
    if (s === 'system' || s === 'light' || s === 'dark') return s
  } catch {
    // ignore
  }
  return 'system'
}

// 把主题应用到 <html data-theme>；system 时移除，交给 prefers-color-scheme
function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

interface PrefsValue {
  energyUnit: EnergyUnit
  setEnergyUnit: (u: EnergyUnit) => void
  toEnergy: (kcal: number) => number
  fromEnergy: (shown: number) => number
  theme: Theme
  setTheme: (t: Theme) => void
}

const PrefsContext = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [energyUnit, setU] = useState<EnergyUnit>(detectEnergy)
  const [theme, setT] = useState<Theme>(detectTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setEnergyUnit = useCallback((u: EnergyUnit) => {
    setU(u)
    try {
      localStorage.setItem(ENERGY_KEY, u)
    } catch {
      // ignore
    }
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setT(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      // ignore
    }
  }, [])

  const toEnergy = useCallback(
    (kcal: number) => (energyUnit === 'kJ' ? Math.round(kcal * KJ_PER_KCAL) : Math.round(kcal)),
    [energyUnit],
  )
  const fromEnergy = useCallback(
    (shown: number) => (energyUnit === 'kJ' ? shown / KJ_PER_KCAL : shown),
    [energyUnit],
  )

  return (
    <PrefsContext.Provider value={{ energyUnit, setEnergyUnit, toEnergy, fromEnergy, theme, setTheme }}>
      {children}
    </PrefsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs 必须在 PrefsProvider 内使用')
  return ctx
}
