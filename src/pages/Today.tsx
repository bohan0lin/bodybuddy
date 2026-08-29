import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useStore } from '../data/store'
import { dateOffset, formatDateShort, macrosByDate, sumMacros, todayStr, weekdayOf } from '../lib/nutrition'
import { useT } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'
import ProgressRing from '../components/ProgressRing'
import MacroBar from '../components/MacroBar'
import DayRings from '../components/DayRings'

export default function Today() {
  const { meals, profile, latestWeight, prevWeight, weightLogs } = useStore()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const { energyUnit, toEnergy } = usePrefs()
  const energyLabel = t(energyUnit === 'kJ' ? 'energy.kJ' : 'energy.kcal')
  const today = todayStr()

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today), [meals, today])
  const totals = useMemo(() => sumMacros(todayMeals), [todayMeals])
  const byDate = useMemo(() => macrosByDate(meals), [meals])

  const targets = { protein: profile.targetProtein, carbs: profile.targetCarbs, fat: profile.targetFat }
  const weekdayLetters = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = dateOffset(i - 6)
        const m = byDate.get(date) ?? { protein: 0, carbs: 0, fat: 0, calories: 0 }
        return { date, m, isToday: date === today, wd: weekdayLetters[weekdayOf(date)] }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byDate, today, lang],
  )

  const weightDelta =
    latestWeight && prevWeight ? +(latestWeight.weight - prevWeight.weight).toFixed(1) : null

  const trend = useMemo(() => {
    const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.slice(-7).map((w) => ({ date: formatDateShort(w.date), w: w.weight }))
  }, [weightLogs])

  const yTicks = useMemo(() => {
    if (trend.length < 2) return { domain: [0, 1] as [number, number], ticks: [] as number[] }
    const ys = trend.map((x) => x.w)
    const min = Math.floor(Math.min(...ys) / 5) * 5
    const max = Math.ceil(Math.max(...ys) / 5) * 5
    const ticks: number[] = []
    for (let v = min; v <= max; v += 5) ticks.push(v)
    return { domain: [min, max] as [number, number], ticks }
  }, [trend])

  const dateLabel =
    lang === 'zh'
      ? new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
      : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()

  return (
    <div className="page">
      {/* 顶部：日期 + 日历入口 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <p className="eyebrow" style={{ margin: 0 }}>{dateLabel}</p>
        <button className="btn-ghost" style={{ padding: 4, color: 'var(--text-dim)', marginRight: 44 }} onClick={() => navigate('/calendar')} aria-label="calendar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2.5" x2="8" y2="6.5" />
            <line x1="16" y1="2.5" x2="16" y2="6.5" />
          </svg>
        </button>
      </div>

      {/* 过去 7 天 */}
      <div className="card" style={{ padding: '18px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {week.map((d) => (
            <button key={d.date} onClick={() => navigate('/day/' + d.date)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: d.isToday ? 'var(--accent)' : 'var(--text-muted)' }}>{d.wd}</span>
              <DayRings protein={d.m.protein} carbs={d.m.carbs} fat={d.m.fat} targets={targets} size={36} stroke={3} />
            </button>
          ))}
        </div>
      </div>

      {/* 今日摄入 —— 主体，点击去记一餐 */}
      <button className="card" onClick={() => navigate('/log')} style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span className="card-label" style={{ margin: 0 }}>{t('today.intake')}</span>
          <span className="dim" style={{ fontSize: 13 }}>{t('today.logMeal')} ›</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <ProgressRing value={toEnergy(totals.calories)} target={toEnergy(profile.targetCalories)} caption={energyLabel} />
          <div style={{ flex: 1 }}>
            <MacroBar label={t('macro.protein')} value={totals.protein} target={profile.targetProtein} color="var(--protein)" />
            <MacroBar label={t('macro.carbs')} value={totals.carbs} target={profile.targetCarbs} color="var(--carbs)" />
            <MacroBar label={t('macro.fat')} value={totals.fat} target={profile.targetFat} color="var(--fat)" />
          </div>
        </div>
      </button>

      {/* 最新体重 */}
      <button className="card" onClick={() => navigate('/body')} style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span className="card-label" style={{ margin: 0 }}>{t('today.latestWeight')}</span>
          <span className="dim" style={{ fontSize: 13 }}>{t('today.bodyData')} ›</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          <div>
            {latestWeight ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="stat-xl num">{latestWeight.weight}</span>
                <span className="stat-unit">kg</span>
                {weightDelta !== null && weightDelta !== 0 && (
                  <span className={'delta num ' + (weightDelta < 0 ? 'down' : 'up')}>{weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta)}</span>
                )}
              </div>
            ) : (
              <span className="muted">{t('common.noRecords')}</span>
            )}
          </div>
          {latestWeight?.bodyFat != null && (
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="stat-lg num">{latestWeight.bodyFat}</span>
                <span className="stat-unit">{t('today.pctFat')}</span>
              </div>
            </div>
          )}
        </div>
        {trend.length >= 2 && (
          <div style={{ marginTop: 14 }}>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={trend} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickMargin={6} padding={{ left: 10, right: 6 }} interval="preserveStartEnd" />
                <YAxis domain={yTicks.domain} ticks={yTicks.ticks} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickMargin={4} width={28} />
                <Line type="monotone" dataKey="w" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2, fill: 'var(--accent)' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </button>

      {/* AI 建议 */}
      <button className="btn btn-accent btn-block" onClick={() => navigate('/ai')} style={{ padding: '18px', fontSize: 16 }}>
        ✦ {t('today.aiButton')}
      </button>
    </div>
  )
}
