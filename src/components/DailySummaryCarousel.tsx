import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useT } from '../lib/i18n'
import type { Macros, Workout } from '../types'
import AppIcon from './AppIcon'

interface Props {
  targets: Macros
  consumed: Macros
  todayWorkouts: Workout[]
  onLogWorkout: () => void
}

function PercentRing({ pct, hasTarget }: { pct: number; hasTarget: boolean }) {
  const size = 86
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = Math.max(0, Math.min(1, pct / 100))
  return (
    <div className="pct-ring">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-dim)" strokeWidth={stroke} />
        {hasTarget && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
        )}
      </svg>
      <b className="num">{hasTarget ? `${Math.round(pct)}%` : '—'}</b>
    </div>
  )
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const FLIP_THRESHOLD = 44

export default function DailySummaryCarousel({ targets, consumed, todayWorkouts, onLogWorkout }: Props) {
  const { t } = useT()
  // top = 哪张卡在最上面：0 营养 / 1 运动
  const [top, setTop] = useState(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const wkLabel = (k: string) => t(('workout.type.' + k) as 'workout.type.strength')

  const hasTarget = targets.calories > 0
  const remaining = Math.max(0, Math.round(targets.calories - consumed.calories))
  const pct = hasTarget ? (consumed.calories / targets.calories) * 100 : 0
  const totalMin = todayWorkouts.reduce((s, w) => s + w.durationMin, 0)
  const totalBurn = todayWorkouts.reduce((s, w) => s + w.calories, 0)
  const latest = todayWorkouts[todayWorkouts.length - 1]

  function onDown(e: React.PointerEvent) {
    startY.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging) return
    setDrag(clamp(e.clientY - startY.current, -140, 140))
  }
  function onUp() {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(drag) > FLIP_THRESHOLD) setTop((c) => 1 - c) // 上下拖动都翻到另一张
    setDrag(0)
  }

  const macroCell = (label: string, v: number, tgt: number) => (
    <div className="macro-cell">
      {label}
      <strong className="num">{Math.round(v)}{tgt > 0 ? ` / ${tgt}g` : 'g'}</strong>
    </div>
  )

  const nutritionFace: ReactNode = (
    <>
      <div className="hero-top">
        <div>
          <div className="hero-label">{hasTarget ? t('today.remaining') : t('today.intake')}</div>
          <div>
            <span className="hero-value num">{(hasTarget ? remaining : Math.round(consumed.calories)).toLocaleString()}</span>
            <span className="hero-unit">{t('today.kcal')}</span>
          </div>
          <div className="hero-sub">
            {hasTarget
              ? t('today.consumedOf', { consumed: Math.round(consumed.calories).toLocaleString(), target: targets.calories.toLocaleString() })
              : t('today.setGoalHint')}
          </div>
        </div>
        <PercentRing pct={pct} hasTarget={hasTarget} />
      </div>
      <div className="macro-row">
        {macroCell(t('macro.protein'), consumed.protein, targets.protein)}
        {macroCell(t('macro.carbs'), consumed.carbs, targets.carbs)}
        {macroCell(t('macro.fat'), consumed.fat, targets.fat)}
      </div>
    </>
  )

  const workoutFace: ReactNode = latest ? (
    <>
      <div className="hero-top">
        <div>
          <div className="hero-label">{t('today.workout')}</div>
          <div>
            <span className="hero-value num">{totalMin}</span>
            <span className="hero-unit">{t('workout.min')}</span>
          </div>
          <div className="hero-sub">{wkLabel(latest.type)}</div>
        </div>
        <div className="workout-emblem"><AppIcon name="dumbbell" size={28} /></div>
      </div>
      <div className="workout-stats">
        <div className="macro-cell">{t('today.focus')}<strong>{latest.note || wkLabel(latest.type)}</strong></div>
        <div className="macro-cell">{t('today.estBurn')}<strong className="num">{Math.round(totalBurn)} {t('today.kcal')}</strong></div>
        <div className="macro-cell">{t('workout.section')}<strong>{todayWorkouts.length > 1 ? t('today.activities', { n: todayWorkouts.length }) : wkLabel(latest.type)}</strong></div>
      </div>
    </>
  ) : (
    <div className="workout-empty">
      <div className="hero-label">{t('today.workout')}</div>
      <div className="hero-value num" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>{t('today.noWorkout')}</div>
      <button className="btn btn-accent" type="button" onClick={onLogWorkout}>{t('nav.logWorkout')}</button>
    </div>
  )

  const faces: ReactNode[] = [nutritionFace, workoutFace]
  const labels = [t('today.remaining'), t('today.workout')]

  function cardStyle(i: number): CSSProperties {
    const isTop = top === i
    if (isTop) return { zIndex: 2, transform: `translateY(${dragging ? drag : 0}px)`, opacity: 1, touchAction: 'none', cursor: 'grab' }
    return { zIndex: 1, transform: 'translateY(16px) scale(0.95)', opacity: 0.72, pointerEvents: 'none' }
  }

  return (
    <>
      <div className={'summary-stack' + (dragging ? ' dragging' : '')} aria-label={`${labels[0]} / ${labels[1]}`}>
        {faces.map((content, i) => {
          const isTop = top === i
          return (
            <article
              key={i}
              className="float-card summary-card"
              style={cardStyle(i)}
              inert={!isTop ? true : undefined}
              aria-hidden={!isTop ? true : undefined}
              onPointerDown={isTop ? onDown : undefined}
              onPointerMove={isTop ? onMove : undefined}
              onPointerUp={isTop ? onUp : undefined}
              onPointerCancel={isTop ? onUp : undefined}
            >
              {content}
            </article>
          )
        })}
      </div>
      <div className="summary-dots" role="group" aria-label={`${labels[0]} / ${labels[1]}`}>
        {[0, 1].map((i) => (
          <button key={i} className={'summary-dot' + (top === i ? ' on' : '')} type="button" aria-current={top === i ? 'true' : undefined} aria-label={labels[i]} onClick={() => setTop(i)} />
        ))}
      </div>
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {labels[top]}
      </span>
    </>
  )
}
