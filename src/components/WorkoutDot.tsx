// 运动标记：圆胖实心哑铃（方案 A），主页/日历里标注当天有运动
export default function WorkoutDot({ size = 13, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden style={{ display: 'block' }}>
      <rect x="2.5" y="6.8" width="4.6" height="10.4" rx="2.3" />
      <rect x="16.9" y="6.8" width="4.6" height="10.4" rx="2.3" />
      <rect x="6.6" y="10" width="10.8" height="4" rx="2" />
    </svg>
  )
}
