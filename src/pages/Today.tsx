import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useStore } from '../data/store'
import { formatDateShort, sumMacros, todayStr } from '../lib/nutrition'
import ProgressRing from '../components/ProgressRing'
import MacroBar from '../components/MacroBar'

export default function Today() {
  const { meals, profile, latestWeight, prevWeight, weightLogs } = useStore()
  const navigate = useNavigate()
  const today = todayStr()

  const todayMeals = useMemo(
    () => meals.filter((m) => m.date === today),
    [meals, today],
  )
  const totals = useMemo(() => sumMacros(todayMeals), [todayMeals])

  // 近期体重（最多 7 次）做卡片内迷你趋势
  const trend = useMemo(() => {
    const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.slice(-7).map((w) => ({ date: formatDateShort(w.date), w: w.weight }))
  }, [weightLogs])

  // 迷你趋势的 y 轴用「整 5」范围与刻度（如 60 / 65 / 70），比身体页更宽松
  const yTicks = useMemo(() => {
    if (trend.length < 2) return { domain: [0, 1] as [number, number], ticks: [] as number[] }
    const ys = trend.map((t) => t.w)
    const min = Math.floor(Math.min(...ys) / 5) * 5
    const max = Math.ceil(Math.max(...ys) / 5) * 5
    const ticks: number[] = []
    for (let v = min; v <= max; v += 5) ticks.push(v)
    return { domain: [min, max] as [number, number], ticks }
  }, [trend])

  const weightDelta =
    latestWeight && prevWeight ? +(latestWeight.weight - prevWeight.weight).toFixed(1) : null

  const dateLabel = new Date()
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
          <span className="card-label" style={{ margin: 0 }}>最新体重</span>
          <span className="dim" style={{ fontSize: 13 }}>身体数据 ›</span>
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
              <span className="muted">还没有记录</span>
            )}
          </div>
          {latestWeight?.bodyFat != null && (
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="stat-lg num">{latestWeight.bodyFat}</span>
                <span className="stat-unit">% 体脂</span>
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
          <span className="card-label" style={{ margin: 0 }}>今日摄入</span>
          <span className="dim" style={{ fontSize: 13 }}>记一餐 ›</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <ProgressRing value={totals.calories} target={profile.targetCalories} caption="千卡" />
          <div style={{ flex: 1 }}>
            <MacroBar label="蛋白" value={totals.protein} target={profile.targetProtein} color="var(--protein)" />
            <MacroBar label="碳水" value={totals.carbs} target={profile.targetCarbs} color="var(--carbs)" />
            <MacroBar label="脂肪" value={totals.fat} target={profile.targetFat} color="var(--fat)" />
          </div>
        </div>
      </button>

      {/* AI 建议 —— 跳转到 AI 页面 */}
      <button
        className="btn btn-accent btn-block"
        onClick={() => navigate('/ai')}
        style={{ padding: '18px', fontSize: 16 }}
      >
        ✦ AI 建议 · 还能吃什么
      </button>
    </div>
  )
}
