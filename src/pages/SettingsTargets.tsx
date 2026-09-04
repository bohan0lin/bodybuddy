import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'
import SubHeader from '../components/SubHeader'
import EnergyToggle from '../components/EnergyToggle'
import { GOAL_TYPES } from '../types'

export default function SettingsTargets() {
  const { profile, updateProfile } = useStore()
  const { t } = useT()
  const { toEnergy, fromEnergy } = usePrefs()
  const navigate = useNavigate()
  const [form, setForm] = useState(profile)

  function setNum<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: Number(value) || 0 }))
  }
  function setCalories(shown: string) {
    setForm((f) => ({ ...f, targetCalories: Math.round(fromEnergy(Number(shown) || 0)) }))
  }
  function save() {
    updateProfile(form)
    navigate('/settings')
  }

  return (
    <div className="page">
      <SubHeader title={t('settings.dailyTargets')} />
      <div className="card">
        <p className="card-label" style={{ marginBottom: 14 }}>{t('me.chooseGoal')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {GOAL_TYPES.map((g) => (
            <button
              key={g}
              type="button"
              className={'chip' + (form.goalType === g ? ' active' : '')}
              style={{ justifyContent: 'center', borderRadius: 14, padding: '12px 8px' }}
              aria-pressed={form.goalType === g}
              onClick={() => setForm((f) => ({ ...f, goalType: g }))}
            >
              {t(('me.goal.' + g) as 'me.goal.recomposition')}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="row">
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('settings.energy')}</span>
              <EnergyToggle />
            </label>
            <input type="number" inputMode="decimal" placeholder="0" value={form.targetCalories ? toEnergy(form.targetCalories) : ''} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('log.proteinG')}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={form.targetProtein || ''} onChange={(e) => setNum('targetProtein', e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>{t('log.carbsG')}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={form.targetCarbs || ''} onChange={(e) => setNum('targetCarbs', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('log.fatG')}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={form.targetFat || ''} onChange={(e) => setNum('targetFat', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={save}>{t('settings.saveTargets')}</button>
      </div>
    </div>
  )
}
