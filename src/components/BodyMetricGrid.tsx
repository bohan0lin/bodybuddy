import { useT } from '../lib/i18n'

// 身体指标 2×2：身高 / 体重 / BMI / 体脂；缺失显示「—」，绝不把 0 当真实测量
export default function BodyMetricGrid({ heightCm, weight, bodyFat, onOpen }: { heightCm: number; weight?: number; bodyFat?: number; onOpen: () => void }) {
  const { t } = useT()
  const h = heightCm > 0 ? heightCm : null
  const bmi = h && weight && weight > 0 ? (weight / (h / 100) ** 2).toFixed(1) : null

  const cell = (label: string, value: string | null, unit?: string) => (
    <div className="metric">
      <span>{label}</span>
      <strong className="num">{value ?? '—'}{value && unit ? <small>{unit}</small> : null}</strong>
    </div>
  )

  return (
    <button className="card" type="button" onClick={onOpen} style={{ width: '100%', display: 'block', textAlign: 'left' }}>
      <div className="card-heading">{t('me.bodyMetrics')}</div>
      <div className="metric-grid">
        {cell(t('me.height'), h ? String(h) : null, 'cm')}
        {cell(t('me.weight'), weight && weight > 0 ? String(weight) : null, 'kg')}
        {cell(t('me.bmi'), bmi)}
        {cell(t('me.bodyFat'), bodyFat != null ? String(bodyFat) : null, '%')}
      </div>
    </button>
  )
}
