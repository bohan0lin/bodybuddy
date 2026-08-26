import { useState } from 'react'
import { useStore } from '../data/store'
import { useAuth } from '../data/auth'
import { useT, type Lang } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'
import EnergyToggle from '../components/EnergyToggle'

export default function Settings() {
  const { profile, updateProfile } = useStore()
  const { session, signOut } = useAuth()
  const { t, lang, setLang } = useT()
  const { toEnergy, fromEnergy } = usePrefs()
  const [form, setForm] = useState(profile)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: key === 'displayName' ? value : Number(value) || 0 }))
    setSaved(false)
  }

  function setCalories(shown: string) {
    setForm((f) => ({ ...f, targetCalories: Math.round(fromEnergy(Number(shown) || 0)) }))
    setSaved(false)
  }

  function handleSave() {
    updateProfile(form)
    setSaved(true)
  }

  const langs: { key: Lang; label: string }[] = [
    { key: 'zh', label: '中文' },
    { key: 'en', label: 'English' },
  ]

  const chipStyle = (active: boolean) => ({
    flex: 1,
    justifyContent: 'center' as const,
    background: active ? 'var(--surface-2)' : 'var(--surface)',
    color: active ? 'var(--accent)' : 'var(--text)',
    borderColor: active ? 'var(--accent)' : 'var(--line)',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div className="page">
      {/* 语言 */}
      <div className="card" style={{ marginTop: 8 }}>
        <p className="card-label">{t('settings.language')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {langs.map((l) => (
            <button key={l.key} onClick={() => setLang(l.key)} className="chip" style={chipStyle(lang === l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="card-label">{t('settings.personal')}</p>
        <div className="field">
          <label>{t('settings.nickname')}</label>
          <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t('settings.heightCm')}</label>
          <input type="number" inputMode="decimal" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
        </div>
      </div>

      <div className="card">
        <p className="card-label">{t('settings.dailyTargets')}</p>
        <div className="row">
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('settings.energy')}</span>
              <EnergyToggle />
            </label>
            <input type="number" inputMode="decimal" value={toEnergy(form.targetCalories)} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('log.proteinG')}</label>
            <input type="number" inputMode="decimal" value={form.targetProtein} onChange={(e) => set('targetProtein', e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>{t('log.carbsG')}</label>
            <input type="number" inputMode="decimal" value={form.targetCarbs} onChange={(e) => set('targetCarbs', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('log.fatG')}</label>
            <input type="number" inputMode="decimal" value={form.targetFat} onChange={(e) => set('targetFat', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleSave}>
          {saved ? t('settings.saved') : t('settings.saveTargets')}
        </button>
      </div>

      <div className="card">
        <p className="card-label">{t('settings.account')}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="muted" style={{ fontSize: 14 }}>{t('settings.signedIn')}</span>
          <span style={{ fontSize: 14 }}>{session?.user.email}</span>
        </div>
        <button className="btn btn-block" onClick={() => signOut()}>
          {t('settings.signOut')}
        </button>
      </div>

      <p className="muted" style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 12 }}>
        {t('settings.footer')}
      </p>
    </div>
  )
}
