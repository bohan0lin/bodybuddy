// 卡路里「套圈」单环：满一圈后继续叠加，越叠越深，最多三圈封顶（无数字）
//   第 1 圈 --cal，第 2 圈 --cal-2（更深），第 3 圈 --cal-3（最深）
interface Props {
  calories: number
  target: number
  size?: number
  stroke?: number
}

const LAPS = ['var(--cal)', 'var(--cal-2)', 'var(--cal-3)']

export default function CalorieRing({ calories, target, size = 36, stroke = 3.4 }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2

  const ratio = target > 0 ? calories / target : 0
  const p = Math.min(ratio, 3) // 最多三圈

  // 每一圈画一段弧，后面的圈叠在前面之上（从起点开始），越靠上颜色越深
  const arcs: { f: number; color: string }[] = []
  if (p > 0) arcs.push({ f: Math.min(p, 1), color: LAPS[0] })
  if (p > 1) arcs.push({ f: Math.min(p - 1, 1), color: LAPS[1] })
  if (p > 2) arcs.push({ f: Math.min(p - 2, 1), color: LAPS[2] })

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={a.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - a.f)}
        />
      ))}
    </svg>
  )
}
