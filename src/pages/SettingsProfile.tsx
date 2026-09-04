import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import SubHeader from '../components/SubHeader'

export default function SettingsProfile() {
  const { profile, updateProfile } = useStore()
  const { t } = useT()
  const navigate = useNavigate()
  const [displayName, setName] = useState(profile.displayName ?? '')
  const [heightCm, setHeight] = useState(profile.heightCm || 0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (saving) return
    setSaving(true)
    setErr(null)
    try {
      await updateProfile({ displayName, heightCm })
      navigate('/settings')
    } catch {
      setErr(t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <SubHeader title={t('me.profile')} />
      <div className="card">
        <div className="field">
          <label>{t('settings.nickname')}</label>
          <input value={displayName} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('settings.heightCm')}</label>
          <input type="number" inputMode="decimal" placeholder="0" value={heightCm || ''} onChange={(e) => setHeight(Number(e.target.value) || 0)} />
        </div>
        {err && <p style={{ color: 'var(--protein)', fontSize: 13, margin: '0 0 12px' }}>{err}</p>}
        <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? t('settings.saving') : t('settings.saveTargets')}</button>
      </div>
    </div>
  )
}
