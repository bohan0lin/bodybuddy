import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '../data/store'
import { formatDateShort, todayStr } from '../lib/nutrition'
import { useT } from '../lib/i18n'

export default function Body() {
  const { weightLogs, upsertWeight, latestWeight } = useStore()
  const navigate = useNavigate()
  const { t } = useT()
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')

  const chartData = useMemo(
    () =>
      [...weightLogs]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({ date: formatDateShort(w.date), weight: w.weight })),
    [weightLogs],
  )

  function handleSave() {
    const w = parseFloat(weight)
    if (!w || w <= 0) return
    upsertWeight({ date, weight: w, bodyFat: bodyFat ? parseFloat(bodyFat) : undefined })
    setWeight('')
    setBodyFat('')
  }

  return (
    <div className="page">
      <button
        className="btn-ghost"
        onClick={() => navigate('/')}
        style={{ padding: 0, marginBottom: 22, fontSize: 14, color: 'var(--text-dim)' }}
      >
        {t('common.backToday')}
      </button>

      {/* 概览 */}
      {latestWeight && (
        <div className="card" style={{ display: 'flex', gap: 28 }}>
          <div>
            <p className="card-label" style={{ marginBottom: 10 }}>{t('body.currentWeight')}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-lg num">{latestWeight.weight}</span>
              <span className="stat-unit">kg</span>
            </div>
          </div>
          {latestWeight.bodyFat != null && (
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 28 }}>
              <p className="card-label" style={{ marginBottom: 10 }}>{t('body.bodyFatRate')}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="stat-lg num">{latestWeight.bodyFat}</span>
                <span className="stat-unit">%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 趋势图 —— 点击进入历史记录 */}
      <button
        className="card"
        onClick={() => navigate('/history')}
        style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="card-label" style={{ margin: 0 }}>{t('body.weightTrend')}</span>
          <span className="dim" style={{ fontSize: 13 }}>{t('body.history')} ›</span>
        </div>
        {chartData.length < 2 ? (
          <div className="empty">{t('body.trendEmpty')}</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                padding={{ left: 12, right: 6 }}
              />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={34}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontSize: 13,
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                cursor={{ stroke: 'var(--line-strong)' }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                name={t('body.weightTrend')}
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </button>

      {/* 记录表单 */}
      <div className="card">
        <p className="card-label">{t('body.logOnce')}</p>
        <div className="field">
          <label>{t('body.date')}</label>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="row">
          <div className="field">
            <label>{t('body.weightKg')}</label>
            <input type="number" inputMode="decimal" step="0.1" placeholder="70.0" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('body.bodyFatOpt')}</label>
            <input type="number" inputMode="decimal" step="0.1" placeholder="18.0" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleSave} disabled={!weight}>
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
