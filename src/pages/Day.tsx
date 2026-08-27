import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { sumMacros } from '../lib/nutrition'
import { useT } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'
import ProgressRing from '../components/ProgressRing'
import MacroBar from '../components/MacroBar'

export default function Day() {
  const { date = '' } = useParams()
  const { meals, profile, deleteMeal } = useStore()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const { energyUnit, toEnergy } = usePrefs()
  const energyLabel = t(energyUnit === 'kJ' ? 'energy.kJ' : 'energy.kcal')

  const dayMeals = useMemo(
    () => meals.filter((m) => m.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [meals, date],
  )
  const totals = useMemo(() => sumMacros(dayMeals), [dayMeals])

  const dateLabel = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: 'long' })
    : ''

  const unitLabel = (u: string): string => {
    if (u === '份') return t('unit.serving')
    if (u === '个') return t('unit.piece')
    if (u === '勺') return t('unit.spoon')
    return u
  }

  return (
    <div className="page">
      <button className="btn-ghost" onClick={() => navigate('/')} style={{ padding: 0, marginBottom: 18, fontSize: 14, color: 'var(--text-dim)' }}>
        {t('common.backToday')}
      </button>
      <p className="eyebrow">{dateLabel}</p>

      {/* 当日合计 */}
      <div className="card">
        <p className="card-label">{t('day.total')}</p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <ProgressRing value={toEnergy(totals.calories)} target={toEnergy(profile.targetCalories)} caption={energyLabel} />
          <div style={{ flex: 1 }}>
            <MacroBar label={t('macro.protein')} value={totals.protein} target={profile.targetProtein} color="var(--protein)" />
            <MacroBar label={t('macro.carbs')} value={totals.carbs} target={profile.targetCarbs} color="var(--carbs)" />
            <MacroBar label={t('macro.fat')} value={totals.fat} target={profile.targetFat} color="var(--fat)" />
          </div>
        </div>
      </div>

      {/* 当日餐食（点可编辑） */}
      <div className="card">
        <p className="card-label">{t('day.meals')}</p>
        {dayMeals.length === 0 ? (
          <div className="empty">{t('day.empty')}</div>
        ) : (
          dayMeals.map((m) => (
            <div key={m.id} className="list-row">
              <button
                onClick={() => navigate('/log', { state: { editMeal: m, returnTo: '/day/' + date } })}
                style={{ flex: 1, textAlign: 'left', minWidth: 0 }}
              >
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}
                  {m.brand && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {m.brand}</span>}
                  {m.amount ? <span className="muted" style={{ fontWeight: 400 }}> · {m.amount}{unitLabel(m.unit ?? '')}</span> : null}
                </div>
                <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {t('meal.' + m.type)} · {toEnergy(m.calories)} {energyLabel} · {t('macro.protein')} {m.protein} {t('macro.carbs')} {m.carbs} {t('macro.fat')} {m.fat}
                </div>
              </button>
              <span className="dim" style={{ fontSize: 13, marginRight: 4 }}>{t('log.edit')} ›</span>
              <button className="btn-ghost" aria-label="delete" style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => deleteMeal(m.id)}>×</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
