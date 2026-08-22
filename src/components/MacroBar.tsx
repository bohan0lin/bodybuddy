import { pct } from '../lib/nutrition'

interface Props {
  label: string
  value: number
  target: number
  color: string
  unit?: string
}

// 极简横条：单项宏量素进度
export default function MacroBar({ label, value, target, color, unit = 'g' }: Props) {
  const p = pct(value, target)
  const over = value > target
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {label}
        </span>
        <span className="num" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <b style={{ color: over ? 'var(--protein)' : 'var(--text)', fontWeight: 500 }}>{Math.round(value)}</b>
          <span style={{ opacity: 0.6 }}> / {target}{unit}</span>
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${p}%`,
            height: '100%',
            background: over ? 'var(--protein)' : color,
            borderRadius: 999,
            transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
    </div>
  )
}
