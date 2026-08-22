import { useState } from 'react'
import { useStore } from '../data/store'
import { useAuth } from '../data/auth'

export default function Settings() {
  const { profile, updateProfile } = useStore()
  const { session, signOut } = useAuth()
  const [form, setForm] = useState(profile)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: key === 'displayName' ? value : Number(value) || 0 }))
    setSaved(false)
  }

  function handleSave() {
    updateProfile(form)
    setSaved(true)
  }

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 8 }}>
        <p className="card-label">个人信息</p>
        <div className="field">
          <label>昵称</label>
          <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>身高 (cm)</label>
          <input type="number" inputMode="decimal" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
        </div>
      </div>

      <div className="card">
        <p className="card-label">每日目标</p>
        <div className="row">
          <div className="field">
            <label>热量 (千卡)</label>
            <input type="number" inputMode="decimal" value={form.targetCalories} onChange={(e) => set('targetCalories', e.target.value)} />
          </div>
          <div className="field">
            <label>蛋白 (g)</label>
            <input type="number" inputMode="decimal" value={form.targetProtein} onChange={(e) => set('targetProtein', e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>碳水 (g)</label>
            <input type="number" inputMode="decimal" value={form.targetCarbs} onChange={(e) => set('targetCarbs', e.target.value)} />
          </div>
          <div className="field">
            <label>脂肪 (g)</label>
            <input type="number" inputMode="decimal" value={form.targetFat} onChange={(e) => set('targetFat', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleSave}>
          {saved ? '已保存 ✓' : '保存目标'}
        </button>
      </div>

      <div className="card">
        <p className="card-label">账号</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="muted" style={{ fontSize: 14 }}>已登录</span>
          <span style={{ fontSize: 14 }}>{session?.user.email}</span>
        </div>
        <button className="btn btn-block" onClick={() => signOut()}>
          退出登录
        </button>
      </div>

      <p className="muted" style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 12 }}>
        BodyBuddy · 云端同步
      </p>
    </div>
  )
}
