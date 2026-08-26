import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useStore } from '../data/store'
import { formatDateShort, sumMacros, todayStr } from '../lib/nutrition'
import { useT } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'
import ProgressRing from '../components/ProgressRing'
import MacroBar from '../components/MacroBar'
import MonthCalendar from '../components/MonthCalendar'

export default function Today() {
  const { meals, profile, latestWeight, prevWeight, weightLogs } = useStore()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const { energyUnit, toEnergy } = usePrefs()
  const energyLabel = t(energyUnit === 'kJ' ? 'energy.kJ' : 'energy.kcal')
  const today = todayStr()

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today), [meals, today])
  const totals = useMemo(() => sumMacros(todayMeals), [todayMeals])
  const datesWithMeals = useMemo(() => new Set(meals.map((m) => m.date)), [meals])

  const weightDelta =
    latestWeight && prevWeight ? +(latestWeight.weight - prevWeight.weight).toFixed(1) : null

  const trend = useMemo(() => {
    const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.slice(-7).map((w) => ({ date: formatDateShort(w.date), w: w.weight }))
  }, [weightLogs])

  const yTicks = useMemo(() => {
    if (trend.length < 2) return { domain: [0, 1] as [number, number], ticks: [] as number[] }
    const ys = trend.map((t) => t.w)
    const min = Math.floor(Math.min(...ys) / 5) * 5
    const max = Math.ceil(Math.max(...ys) / 5) * 5
    const ticks: number[] = []
    for (let v = min; v <= max; v += 5) ticks.push(v)
    return { domain: [min, max] as [number, number], ticks }
  }, [trend])

  const dateLabel =
    lang === 'zh'
      ? new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
      : new Date()
          .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
          .toUpperCase()

  return (
    <div className="page">
      <p className="eyebrow">{dateLabel}</p>

      {/* 最新体重 —— 点击进入身体数据 */}
      <button
        className="card"
        onClick={() => navigate('/body')}
        style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer' }}
      >
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
                  <span className={'delta num ' + (weightDelta < 0 ? 'down' : 'up')}>
                    {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta)}
                  </span>
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

        {/* 卡片内迷你趋势（带坐标轴） */}
        {trend.length >= 2 && (
          <div style={{ marginTop: 14 }}>
            <ResponsiveContainer width="100%" height={96}>
              <LineChart data={trend} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                  padding={{ left: 10, right: 6 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yTicks.domain}
                  ticks={yTicks.ticks}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={4}
                  width={28}
                />
                <Line
                  type="monotone"
                  dataKey="w"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: 'var(--accent)' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </button>

      {/* 今日摄入 —— 点击去记一餐 */}
      <button
        className="card"
        onClick={() => navigate('/log')}
        style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer' }}
      >
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

      {/* AI 建议 —— 跳转到 AI 页面 */}
      <button
        className="btn btn-accent btn-block"
        onClick={() => navigate('/ai')}
        style={{ padding: '18px', fontSize: 16 }}
      >
        ✦ {t('today.aiButton')}
      </button>

      {/* 记录日历 —— 点某天进入详情 */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="card-label">{t('today.calendar')}</p>
        <MonthCalendar datesWithData={datesWithMeals} onSelect={(d) => navigate('/day/' + d)} />
      </div>
    </div>
  )
}
