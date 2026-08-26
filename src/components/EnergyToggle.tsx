import { useT } from '../lib/i18n'
import { usePrefs, type EnergyUnit } from '../lib/prefs'

// 能量单位内联切换（千卡/千焦），改的是全局偏好
export default function EnergyToggle() {
  const { energyUnit, setEnergyUnit } = usePrefs()
  const { t } = useT()
  const opts: EnergyUnit[] = ['kcal', 'kJ']
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {opts.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setEnergyUnit(u)}
          style={{
            fontSize: 11,
            padding: '2px 9px',
            borderRadius: 999,
            border: '1px solid ' + (energyUnit === u ? 'var(--accent)' : 'var(--line)'),
            color: energyUnit === u ? 'var(--accent)' : 'var(--text-muted)',
            background: 'transparent',
            fontWeight: energyUnit === u ? 600 : 400,
          }}
        >
          {t('energy.' + u)}
        </button>
      ))}
    </span>
  )
}
