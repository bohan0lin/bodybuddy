import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { sumMacros } from '../lib/nutrition'
import { useT } from '../lib/i18n'
import ProgressRing from '../components/ProgressRing'
import MacroBar from '../components/MacroBar'

export default function Day() {
  const { date = '' } = useParams()
  const { meals, profile, deleteMeal, workouts, deleteWorkout } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const removing = useRef(false)
  async function remove(kind: 'meal' | 'workout', id: string) {
    if (removing.current) return
    const prompt = kind === 'meal'
      ? (lang === 'zh' ? '删除这条饮食记录？' : 'Delete this meal?')
      : (lang === 'zh' ? '删除这条运动记录？' : 'Delete this workout?')
    if (!window.confirm(prompt)) return
    removing.current = true; setDeleting(true); setDeleteError('')
    try { await (kind === 'meal' ? deleteMeal(id) : deleteWorkout(id)) }
    catch { setDeleteError(lang === 'zh' ? '未能确认删除结果，请重试。' : 'Could not confirm the deletion. Please retry.') }
    finally { removing.current = false; setDeleting(false) }
  }
  const kcalLabel = t('today.kcal')
  const back = (location.state as { back?: string } | null)?.back ?? '/'
  const backLabel = back === '/calendar' ? t('common.backCalendar') : t('common.backToday')

  const dayMeals = useMemo(
    () => meals.filter((m) => m.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [meals, date],
  )
  const totals = useMemo(() => sumMacros(dayMeals), [dayMeals])
  const dayWorkouts = useMemo(
    () => workouts.filter((w) => w.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [workouts, date],
  )

  const dateLabel = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: 'long' })
    : ''

  const unitLabel = (u: string): string => {
    if (u === '份') return t('unit.serving')
    if (u === '个') return t('unit.piece')
    if (u === '勺') return t('unit.spoon')
    return u
  }

  const goEdit = (m: (typeof dayMeals)[number]) =>
    navigate('/log', { state: { editMeal: m, returnTo: '/day/' + date } })

  return (
    <div className="page">
      {deleteError && <p role="alert" className="food-error">{deleteError}</p>}
      {deleting && <p role="status">{lang === 'zh' ? '删除中…' : 'Deleting…'}</p>}
      <fieldset disabled={deleting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <button className="btn-ghost" onClick={() => navigate(back)} style={{ padding: 0, marginBottom: 18, fontSize: 14, color: 'var(--text-dim)' }}>
        {backLabel}
      </button>
      <p className="eyebrow">{dateLabel}</p>

      {/* 当日合计 */}
      <div className="card">
        <p className="card-label">{t('day.total')}</p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <ProgressRing value={totals.calories} target={profile.targetCalories} caption={kcalLabel} />
          <div style={{ flex: 1 }}>
            <MacroBar label={t('macro.protein')} value={totals.protein} target={profile.targetProtein} color="var(--protein)" />
            <MacroBar label={t('macro.carbs')} value={totals.carbs} target={profile.targetCarbs} color="var(--carbs)" />
            <MacroBar label={t('macro.fat')} value={totals.fat} target={profile.targetFat} color="var(--fat)" />
          </div>
        </div>
      </div>

      {/* 补记这一天 */}
      <button
        className="btn btn-block"
        style={{ marginBottom: 16 }}
        onClick={() => navigate('/log', { state: { logDate: date, returnTo: '/day/' + date } })}
      >
        ＋ {t('nav.logMeal')}
      </button>

      {/* 当日餐食（点可编辑） */}
      <div className="card">
        <p className="card-label">{t('day.meals')}</p>
        {dayMeals.length === 0 ? (
          <div className="empty">{t('day.empty')}</div>
        ) : (
          dayMeals.map((m) => (
            <div key={m.id} className="list-row">
              <button onClick={() => goEdit(m)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}
                  {m.brand && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {m.brand}</span>}
                  {m.amount ? <span className="muted" style={{ fontWeight: 400 }}> · {m.amount}{unitLabel(m.unit ?? '')}</span> : null}
                </div>
                <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {t('meal.' + m.type)} · {Math.round(m.calories)} {kcalLabel} · {t('macro.protein')} {m.protein} {t('macro.carbs')} {m.carbs} {t('macro.fat')} {m.fat}
                </div>
              </button>
              <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 8px', color: 'var(--accent)' }} onClick={() => goEdit(m)}>{t('log.edit')}</button>
              <button className="btn-ghost" aria-label={lang === 'zh' ? `删除 ${m.name}` : `Delete ${m.name}`} style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => remove('meal', m.id)}>×</button>
            </div>
          ))
        )}
      </div>

      {/* 补记运动 */}
      <button
        className="btn btn-block"
        style={{ marginBottom: 16 }}
        onClick={() => navigate('/workout', { state: { logDate: date, returnTo: '/day/' + date } })}
      >
        {t('workout.add')}
      </button>

      {/* 当日运动（点可编辑） */}
      <div className="card">
        <p className="card-label">{t('workout.section')}</p>
        {dayWorkouts.length === 0 ? (
          <div className="empty">{t('workout.none')}</div>
        ) : (
          dayWorkouts.map((w) => (
            <div key={w.id} className="list-row">
              <button onClick={() => navigate('/workout', { state: { editWorkout: w, returnTo: '/day/' + date } })} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>
                  {t(('workout.type.' + w.type) as 'workout.type.strength')}
                  {w.note && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {w.note}</span>}
                </div>
                <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {w.durationMin} {t('workout.min')} · {Math.round(w.calories)} {kcalLabel}
                </div>
              </button>
              <button className="btn-ghost" aria-label={lang === 'zh' ? `删除 ${t('workout.type.' + w.type)}` : `Delete ${t('workout.type.' + w.type)}`} style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => remove('workout', w.id)}>×</button>
            </div>
          ))
        )}
      </div>
      </fieldset>
    </div>
  )
}
