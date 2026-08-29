// 每日三环缩略：外=蛋白、中=碳水、内=脂肪（各自 / 目标）
interface Props {
  protein: number
  carbs: number
  fat: number
  targets: { protein: number; carbs: number; fat: number }
  size?: number
  stroke?: number
  dim?: boolean // 未来/无数据时更暗
}

export default function DayRings({ protein, carbs, fat, targets, size = 40, stroke = 3.5, dim = false }: Props) {
  const gap = stroke * 0.9
  const rings = [
    { r: (size - stroke) / 2, color: 'var(--protein)', pct: targets.protein > 0 ? Math.min(1, protein / targets.protein) : 0 },
    { r: (size - stroke) / 2 - (stroke + gap), color: 'var(--carbs)', pct: targets.carbs > 0 ? Math.min(1, carbs / targets.carbs) : 0 },
    { r: (size - stroke) / 2 - 2 * (stroke + gap), color: 'var(--fat)', pct: targets.fat > 0 ? Math.min(1, fat / targets.fat) : 0 },
  ]
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', opacity: dim ? 0.4 : 1, display: 'block' }}>
      {rings.map((ring, i) => {
        const c = 2 * Math.PI * ring.r
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={ring.r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={ring.r}
              fill="none"
              stroke={ring.color}
              strokeWidth={stroke}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - ring.pct)}
              strokeLinecap="round"
            />
          </g>
        )
      })}
    </svg>
  )
}
