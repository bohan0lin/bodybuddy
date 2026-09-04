import { useRef, useState } from 'react'
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
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
          />
        )}
      </svg>
      <b className="num">{hasTarget ? `${Math.round(pct)}%` : '—'}</b>
    </div>
  )
}

export default function DailySummaryCarousel({ targets, consumed, todayWorkouts, onLogWorkout }: Props) {
  const { t } = useT()
  const [card, setCard] = useState(0)
  const startX = useRef(0)
  const wkLabel = (k: string) => t(('workout.type.' + k) as 'workout.type.strength')

  const hasTarget = targets.calories > 0
  const remaining = Math.max(0, Math.round(targets.calories - consumed.calories))
  const pct = hasTarget ? (consumed.calories / targets.calories) * 100 : 0

  const totalMin = todayWorkouts.reduce((s, w) => s + w.durationMin, 0)
  const totalBurn = todayWorkouts.reduce((s, w) => s + w.calories, 0)
  const latest = todayWorkouts[todayWorkouts.length - 1]

  const macroCell = (label: string, v: number, tgt: number) => (
    <div className="macro-cell">
      {label}
      <strong className="num">{Math.round(v)}{tgt > 0 ? ` / ${tgt}g` : 'g'}</strong>
    </div>
  )

  return (
    <>
      <section className="summary-carousel float-card" aria-label={`${t('today.remaining')} / ${t('today.workout')}`}>
        <div
          className={'summary-track' + (card === 1 ? ' second' : '')}
          onPointerDown={(e) => (startX.current = e.clientX)}
          onPointerUp={(e) => {
            const dx = e.clientX - startX.current
            if (Math.abs(dx) > 35) setCard(dx < 0 ? 1 : 0)
          }}
        >
          {/* 营养面 */}
          <article className="summary-face">
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
          </article>

          {/* 运动面 */}
          <article className="summary-face">
            {latest ? (
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
            )}
          </article>
        </div>
        <button className="summary-next" type="button" aria-label={card === 0 ? t('today.showWorkout') : t('today.showNutrition')} onClick={() => setCard(card === 0 ? 1 : 0)}>
          <AppIcon name={card === 0 ? 'chevron-right' : 'chevron-left'} size={18} />
        </button>
      </section>
      <div className="summary-dots" role="group" aria-label={`${t('today.remaining')} / ${t('today.workout')}`}>
        <button className={'summary-dot' + (card === 0 ? ' on' : '')} type="button" aria-current={card === 0 ? 'true' : undefined} aria-label={t('today.remaining')} onClick={() => setCard(0)} />
        <button className={'summary-dot' + (card === 1 ? ' on' : '')} type="button" aria-current={card === 1 ? 'true' : undefined} aria-label={t('today.workout')} onClick={() => setCard(1)} />
      </div>
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {card === 0 ? t('today.remaining') : t('today.workout')}
      </span>
    </>
  )
}
