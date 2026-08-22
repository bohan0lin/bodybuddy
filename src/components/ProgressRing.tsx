interface Props {
  value: number
  target: number
  size?: number
  stroke?: number
  color?: string
  caption?: string
}

// 极简圆环：中心显示已摄入数值，下方为目标
export default function ProgressRing({
  value,
  target,
  size = 128,
  stroke = 6,
  color = 'var(--cal)',
  caption,
}: Props) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = target > 0 ? Math.min(1, value / target) : 0
  const offset = circumference * (1 - ratio)
  const over = value > target

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? 'var(--protein)' : color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <span className="num" style={{ fontSize: 30, fontWeight: 200 }}>
          {Math.round(value)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }} className="num">
          / {target}
        </span>
        {caption && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginTop: 3,
            }}
          >
            {caption}
          </span>
        )}
      </div>
    </div>
  )
}
