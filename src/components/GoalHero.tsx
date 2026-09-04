import { useT } from '../lib/i18n'
import type { Macros } from '../types'
import AppIcon from './AppIcon'

// 目标英雄区：有 goalType 时展示目标名 + 说明；否则退化为「每日目标」并突出真实数值
export default function GoalHero({ goalType, targets, onEdit }: { goalType?: string | null; targets: Macros; onEdit: () => void }) {
  const { t } = useT()
  const goalName = goalType ? t(('me.goal.' + goalType) as 'me.goal.recomposition') : null
  const fmt = (v: number, unit = '') => (v > 0 ? `${v}${unit}` : '—')

  return (
    <section className="goal-hero float-card" aria-label={goalName ?? t('me.dailyGoal')}>
      <div className="goal-kicker">
        <span>{goalName ? t('me.goalKicker') : t('me.dailyGoal')}</span>
        <button className="edit-goal" type="button" onClick={onEdit}><AppIcon name="pencil" size={12} />{t('me.edit')}</button>
      </div>
      {goalName && <div className="goal-title">{goalName}</div>}
      {goalName && <div className="goal-copy">{t('me.goalCopy')}</div>}
      <div className="goal-targets">
        <div className="goal-target primary">
          <span>{t('me.dailyEnergy')}</span>
          <strong className="num">{targets.calories > 0 ? targets.calories.toLocaleString() : '—'}</strong>
          <span>{t('today.kcal')}</span>
        </div>
        <div className="goal-target"><span>{t('macro.protein')}</span><strong className="num">{fmt(targets.protein, 'g')}</strong></div>
        <div className="goal-target"><span>{t('macro.carbs')}</span><strong className="num">{fmt(targets.carbs, 'g')}</strong></div>
        <div className="goal-target"><span>{t('macro.fat')}</span><strong className="num">{fmt(targets.fat, 'g')}</strong></div>
      </div>
    </section>
  )
}
