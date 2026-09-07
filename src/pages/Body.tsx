import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  const { weightLogs, upsertWeight, latestWeight, profile, updateProfile } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const back = (location.state as { back?: string } | null)?.back ?? '/'
  const backLabel = back === '/settings' ? t('common.backMe') : t('common.backToday')
  const [date, setDate] = useState(todayStr())
  const existing = weightLogs.find((entry) => entry.date === todayStr())
  const [weight, setWeight] = useState(existing ? String(existing.weight) : '')
  const [bodyFat, setBodyFat] = useState(existing?.bodyFat != null ? String(existing.bodyFat) : '')
  const [height, setHeight] = useState(profile.heightCm > 0 ? String(profile.heightCm) : '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'saved' | 'error' | null>(null)
  const heightChanged = Number(height) !== profile.heightCm
  const valid = Boolean(date && date <= todayStr())
    && (!height || (Number(height) > 0 && Number(height) <= 300))
    && (!weight || (Number(weight) > 0 && Number(weight) <= 1000))
    && (!bodyFat || (Number(bodyFat) > 0 && Number(bodyFat) <= 100 && Boolean(weight)))
    && Boolean(weight || (height && heightChanged))

  function changeDate(next: string) {
    setDate(next)
    const entry = weightLogs.find((item) => item.date === next)
    setWeight(entry ? String(entry.weight) : '')
    setBodyFat(entry?.bodyFat != null ? String(entry.bodyFat) : '')
    setStatus(null)
  }

  const chartData = useMemo(
    () =>
      [...weightLogs]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({ date: formatDateShort(w.date), weight: w.weight })),
    [weightLogs],
  )

  async function handleSave() {
    if (saving || !valid) return
    setSaving(true)
    setStatus(null)
    try {
      if (heightChanged && height) await updateProfile({ heightCm: Number(height) })
      if (weight) await upsertWeight({ date, weight: Number(weight), bodyFat: bodyFat ? Number(bodyFat) : undefined })
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <button
        className="btn-ghost"
        onClick={() => navigate(back)}
        style={{ padding: 0, marginBottom: 22, fontSize: 14, color: 'var(--text-dim)' }}
      >
        {backLabel}
      </button>

      <p className="eyebrow">{t('me.bodyMetrics')}</p>

      {/* Unified metric editor */}
      <form className="card" onSubmit={(event) => { event.preventDefault(); void handleSave() }} onChange={() => setStatus(null)}>
        <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <p className="muted" style={{ fontSize: 13 }}>{t('body.metricsHint')}</p>
          <div className="field">
            <label htmlFor="body-height">{t('settings.heightCm')}</label>
            <input id="body-height" type="number" inputMode="decimal" min="1" max="300" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="body-date">{t('body.date')}</label>
            <input id="body-date" type="date" required value={date} max={todayStr()} onChange={(e) => changeDate(e.target.value)} />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="body-weight">{t('body.weightKg')}</label>
              <input id="body-weight" type="number" inputMode="decimal" min="0.1" max="1000" step="0.1" placeholder="70.0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="body-fat">{t('body.bodyFatOpt')}</label>
              <input id="body-fat" type="number" inputMode="decimal" min="0.1" max="100" step="0.1" placeholder="18.0" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
            </div>
          </div>
          {status && <p role={status === 'error' ? 'alert' : 'status'}>{t(status === 'error' ? 'body.saveFailed' : 'settings.saved')}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={saving || !valid}>
            {t(saving ? 'settings.saving' : 'common.save')}
          </button>
        </fieldset>
      </form>

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


    </div>
  )
}
