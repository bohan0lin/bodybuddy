import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { todayStr } from '../lib/nutrition'
import { ACTIVITY_TYPES, estimateBurn } from '../lib/workout'
import type { Workout } from '../types'
import { RecordConflict } from '../lib/recordMutations'

interface NavState {
  logDate?: string
  editWorkout?: Workout
  returnTo?: string
}

const QUICK_MIN = [30, 45, 60, 90]

export default function LogWorkout() {
  const { addWorkout, updateWorkout, deleteWorkout, latestWeight } = useStore()
  const { t, lang } = useT()
  const zh = lang === 'zh'
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as NavState | null) ?? {}
  const edit = state.editWorkout
  const date = edit?.date ?? state.logDate ?? todayStr()
  const returnTo = state.returnTo ?? '/'

  const [type, setType] = useState(edit?.type ?? 'strength')
  const [duration, setDuration] = useState(edit ? String(edit.durationMin) : '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [cal, setCal] = useState(edit ? String(edit.calories) : '') // Empty input uses the estimated burn.
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const saving = useRef(false)
  const id = useRef(edit?.id ?? crypto.randomUUID())
  const submitted = useRef<Omit<Workout, 'id' | 'createdAt'> | null>(null)

  const weight = latestWeight?.weight ?? 0
  const minutes = Number(duration)
  const autoBurn = estimateBurn(type, weight, minutes)
  const finalCal = cal !== '' ? Number(cal) : autoBurn
  const valid = Number.isFinite(minutes) && minutes > 0 && minutes <= 1440
    && Number.isFinite(finalCal) && finalCal >= 0 && finalCal <= 20000 && note.length <= 1000

  async function save() {
    if (saving.current || !valid || conflict) return
    saving.current = true; setBusy(true); setError(''); setAttempted(true)
    // Keep the same ID and content when the server may have committed already.
    submitted.current ??= { date, type, note: note.trim(), durationMin: minutes, calories: finalCal }
    try {
      if (edit) await updateWorkout(edit.id, submitted.current)
      else await addWorkout(submitted.current, id.current)
    } catch (reason) {
      const collision = reason instanceof RecordConflict
      setConflict(collision)
      setError(collision
        ? (zh ? '已有记录与本次内容不同。请返回查看已有记录。' : 'This record has different saved content. Go back and review it.')
        : (zh ? '未能确认保存结果。内容已保留，请重试；成功后可继续编辑。' : 'Could not confirm the save. Retry these changes; you can edit after saving.'))
      saving.current = false; setBusy(false)
      return
    }
    navigate(returnTo)
  }

  async function remove() {
    if (!edit || saving.current || attempted) return
    if (!window.confirm(zh ? '删除这条运动记录？' : 'Delete this workout?')) return
    saving.current = true; setBusy(true); setError('')
    try { await deleteWorkout(edit.id) }
    catch {
      setError(zh ? '未能确认删除结果，请重试。' : 'Could not confirm the deletion. Please retry.')
      saving.current = false; setBusy(false)
      return
    }
    navigate(returnTo)
  }

  return (
    <div className="page">
      <button className="btn-ghost" disabled={busy} onClick={() => navigate(returnTo)} style={{ padding: 0, fontSize: 14, color: 'var(--text-dim)' }}>
        {t('common.cancel')}
      </button>
      <p className="eyebrow" style={{ margin: '20px 0 22px' }}>{t('workout.title')}</p>

      <fieldset className="card" disabled={busy || attempted} style={{ minWidth: 0 }}>
        {/* Activity type */}
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

        {/* Duration */}
        <div className="field">
          <label>{t('workout.duration')}（{t('workout.min')}）</label>
          <input aria-label={t('workout.duration')} type="number" min="1" max="1440" inputMode="numeric" placeholder="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {QUICK_MIN.map((m) => (
              <button key={m} className={'chip' + (minutes === m ? ' active' : '')} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setDuration(String(m))}>{m}{t('workout.min')}</button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="field">
          <label>{t('workout.note')}</label>
          <input aria-label={t('workout.note')} maxLength={1000} value={note} placeholder={t('workout.notePh')} onChange={(e) => setNote(e.target.value)} />
        </div>

        {/* Editable estimated burn */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 12 }}>{t('workout.burn')}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 16, color: 'var(--accent)' }}>≈</span>
              <input
                type="number"
                aria-label={t('workout.burn')}
                min="0"
                max="20000"
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
      </fieldset>

      {error && <p role="alert" className="food-error">{error}</p>}
      <div className="row">
        {edit && <button className="btn" disabled={busy || attempted} style={{ color: 'var(--protein)' }} onClick={remove}>{t('workout.delete')}</button>}
        <button className="btn btn-primary" onClick={save} disabled={busy || !valid || conflict}>
          {busy ? (zh ? '处理中…' : 'Saving…') : attempted && error ? t('common.retry') : edit ? t('workout.update') : t('workout.save')}
        </button>
      </div>
    </div>
  )
}
