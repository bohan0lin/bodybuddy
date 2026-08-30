import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { todayStr } from '../lib/nutrition'
import { ACTIVITY_TYPES, estimateBurn } from '../lib/workout'
import type { Workout } from '../types'

interface NavState {
  logDate?: string
  editWorkout?: Workout
  returnTo?: string
}

const QUICK_MIN = [30, 45, 60, 90]

export default function LogWorkout() {
  const { addWorkout, updateWorkout, deleteWorkout, latestWeight } = useStore()
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as NavState | null) ?? {}
  const edit = state.editWorkout
  const date = edit?.date ?? state.logDate ?? todayStr()
  const returnTo = state.returnTo ?? '/'

  const [type, setType] = useState(edit?.type ?? 'strength')
  const [duration, setDuration] = useState(edit ? String(edit.durationMin) : '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [cal, setCal] = useState(edit ? String(edit.calories) : '') // '' = 跟随自动估算

  const weight = latestWeight?.weight ?? 0
  const minutes = Number(duration) || 0
  const autoBurn = estimateBurn(type, weight, minutes)
  const finalCal = cal !== '' ? Number(cal) || 0 : autoBurn

  function save() {
    const payload = { date, type, note: note.trim() || undefined, durationMin: minutes, calories: finalCal }
    if (edit) updateWorkout(edit.id, payload)
    else addWorkout(payload)
    navigate(returnTo)
  }

  function remove() {
    if (edit) deleteWorkout(edit.id)
    navigate(returnTo)
  }

  return (
    <div className="page">
      <button className="btn-ghost" onClick={() => navigate(returnTo)} style={{ padding: 0, fontSize: 14, color: 'var(--text-dim)' }}>
        {t('common.cancel')}
      </button>
      <p className="eyebrow" style={{ margin: '20px 0 22px' }}>{t('workout.title')}</p>

      <div className="card">
        {/* 类型 */}
        <div className="field">
          <label>{t('workout.type')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ACTIVITY_TYPES.map((a) => (
              <button
                key={a.key}
                onClick={() => setType(a.key)}
                className="chip"
                style={{ padding: '9px 13px', background: type === a.key ? 'var(--surface-2)' : 'var(--surface)', color: type === a.key ? 'var(--accent)' : 'var(--text)', borderColor: type === a.key ? 'var(--accent)' : 'var(--line)', fontWeight: type === a.key ? 600 : 400 }}
              >
                {t(`workout.type.${a.key}` as 'workout.type.strength')}
              </button>
            ))}
          </div>
        </div>

        {/* 时长 */}
        <div className="field">
          <label>{t('workout.duration')}（{t('workout.min')}）</label>
          <input type="number" inputMode="numeric" placeholder="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {QUICK_MIN.map((m) => (
              <button key={m} className={'chip' + (minutes === m ? ' active' : '')} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setDuration(String(m))}>{m}{t('workout.min')}</button>
            ))}
          </div>
        </div>

        {/* 备注 */}
        <div className="field">
          <label>{t('workout.note')}</label>
          <input value={note} placeholder={t('workout.notePh')} onChange={(e) => setNote(e.target.value)} />
        </div>

        {/* 估算消耗（可改） */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 12 }}>{t('workout.burn')}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 16, color: 'var(--accent)' }}>≈</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={String(autoBurn)}
                value={cal === '' ? '' : cal}
                onChange={(e) => setCal(e.target.value)}
                style={{ width: 70, textAlign: 'right', padding: '4px 0', border: 'none', borderBottom: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--accent)', fontSize: 22 }}
              />
              <span className="muted" style={{ fontSize: 13 }}>{t('today.kcal')}</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>{t('workout.burnHint', { kg: weight || 70 })}</p>
        </div>
      </div>

      <div className="row">
        {edit && <button className="btn" style={{ color: 'var(--protein)' }} onClick={remove}>{t('workout.delete')}</button>}
        <button className="btn btn-primary" onClick={save} disabled={minutes <= 0}>
          {edit ? t('workout.update') : t('workout.save')}
        </button>
      </div>
    </div>
  )
}
