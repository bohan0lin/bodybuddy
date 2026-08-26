import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type EnergyUnit = 'kcal' | 'kJ'
const STORAGE_KEY = 'bodybuddy:energy'
const KJ_PER_KCAL = 4.184

function detect(): EnergyUnit {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'kcal' || s === 'kJ') return s
  } catch {
    // ignore
  }
  return 'kcal'
}

interface PrefsValue {
  energyUnit: EnergyUnit
  setEnergyUnit: (u: EnergyUnit) => void
  toEnergy: (kcal: number) => number // 千卡 → 当前单位（取整）
  fromEnergy: (shown: number) => number // 当前单位 → 千卡（存储用）
}

const PrefsContext = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [energyUnit, setU] = useState<EnergyUnit>(detect)

  const setEnergyUnit = useCallback((u: EnergyUnit) => {
    setU(u)
    try {
      localStorage.setItem(STORAGE_KEY, u)
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
    <PrefsContext.Provider value={{ energyUnit, setEnergyUnit, toEnergy, fromEnergy }}>
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
