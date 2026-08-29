import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { macrosByDate, todayStr } from '../lib/nutrition'
import { useT } from '../lib/i18n'
import DayRings from '../components/DayRings'

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Calendar() {
  const { meals, profile } = useStore()
  const { t, lang } = useT()
  const navigate = useNavigate()
  const today = todayStr()
  const byDate = useMemo(() => macrosByDate(meals), [meals])
  const targets = { protein: profile.targetProtein, carbs: profile.targetCarbs, fat: profile.targetFat }

  const now = new Date()
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const atCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const weekdays = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const monthLabel = cursor.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' })

  const cells = useMemo(() => {
    const arr: (number | null)[] = []
    for (let i = 0; i < firstWeekday; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    return arr
  }, [firstWeekday, daysInMonth])

  return (
    <div className="page">
      <button className="btn-ghost" onClick={() => navigate('/')} style={{ padding: 0, marginBottom: 18, fontSize: 14, color: 'var(--text-dim)' }}>
        {t('common.backToday')}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <button className="btn-ghost" style={{ padding: 6, fontSize: 20 }} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="prev">‹</button>
        <span style={{ fontSize: 17, fontWeight: 500 }} className="num">{monthLabel}</span>
        <button className="btn-ghost" style={{ padding: 6, fontSize: 20, opacity: atCurrentMonth ? 0.25 : 1 }} disabled={atCurrentMonth} onClick={() => !atCurrentMonth && setCursor(new Date(year, month + 1, 1))} aria-label="next">›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {weekdays.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '0.06em', color: 'var(--text-muted)', paddingBottom: 4 }}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const date = ymd(year, month, d)
          const isToday = date === today
          const isFuture = date > today
          const m = byDate.get(date) ?? { protein: 0, carbs: 0, fat: 0, calories: 0 }
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => !isFuture && navigate('/day/' + date, { state: { back: '/calendar' } })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0', borderRadius: 10, background: isToday ? 'var(--accent-dim)' : 'transparent', cursor: isFuture ? 'default' : 'pointer' }}
            >
              <span className="num" style={{ fontSize: 12, color: isToday ? 'var(--accent)' : isFuture ? 'var(--text-muted)' : 'var(--text)', fontWeight: isToday ? 600 : 400 }}>{d}</span>
              <DayRings protein={m.protein} carbs={m.carbs} fat={m.fat} targets={targets} size={30} stroke={2.6} dim={isFuture} />
            </button>
          )
        })}
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 22 }}>
        {[
          { c: 'var(--protein)', l: t('macro.protein') },
          { c: 'var(--carbs)', l: t('macro.carbs') },
          { c: 'var(--fat)', l: t('macro.fat') },
        ].map((x) => (
          <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }} />{x.l}
          </span>
        ))}
      </div>
    </div>
  )
}
