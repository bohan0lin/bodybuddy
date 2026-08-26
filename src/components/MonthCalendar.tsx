import { useMemo, useState } from 'react'
import { todayStr } from '../lib/nutrition'
import { useT } from '../lib/i18n'

interface Props {
  datesWithData: Set<string> // 'YYYY-MM-DD'
  onSelect: (date: string) => void
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function MonthCalendar({ datesWithData, onSelect }: Props) {
  const { lang } = useT()
  const today = todayStr()
  const now = new Date()
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 不能翻到未来的月份
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="btn-ghost" style={{ padding: 6, fontSize: 18 }} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="prev">‹</button>
        <span style={{ fontSize: 15, fontWeight: 500 }} className="num">{monthLabel}</span>
        <button
          className="btn-ghost"
          style={{ padding: 6, fontSize: 18, opacity: atCurrentMonth ? 0.25 : 1 }}
          onClick={() => !atCurrentMonth && setCursor(new Date(year, month + 1, 1))}
          disabled={atCurrentMonth}
          aria-label="next"
        >›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {weekdays.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 0' }}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const date = ymd(year, month, d)
          const isToday = date === today
          const isFuture = date > today
          const hasData = datesWithData.has(date)
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => !isFuture && onSelect(date)}
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                borderRadius: 10,
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                background: isToday ? 'var(--accent-dim)' : 'transparent',
                color: isFuture ? 'var(--text-muted)' : 'var(--text)',
                opacity: isFuture ? 0.35 : 1,
                cursor: isFuture ? 'default' : 'pointer',
                fontSize: 13,
              }}
              className="num"
            >
              <span style={{ color: isToday ? 'var(--accent)' : undefined, fontWeight: isToday ? 600 : 400 }}>{d}</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: hasData ? 'var(--accent)' : 'transparent' }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
