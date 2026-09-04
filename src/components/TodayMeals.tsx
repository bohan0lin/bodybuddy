import { useT } from '../lib/i18n'
import type { Meal, MealType } from '../types'
import AppIcon, { type IconName } from './AppIcon'

const MEAL_ICON: Record<MealType, IconName> = {
  breakfast: 'sunrise',
  lunch: 'utensils',
  dinner: 'utensils',
  snack: 'cookie',
}

// 今日餐次：最多展示 3 条，更多则「查看全部」；点一条进入编辑
export default function TodayMeals({ meals, onOpen, onViewAll }: { meals: Meal[]; onOpen: (m: Meal) => void; onViewAll: () => void }) {
  const { t, lang } = useT()
  const shown = meals.slice(0, 3)
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <div className="section-title">
        <strong>{t('today.todaysMeals')}</strong>
        <span className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('today.mealsCount', { n: meals.length })}
          {meals.length > 3 && (
            <>
              <span aria-hidden="true">·</span>
              <button className="link" type="button" onClick={onViewAll}>{t('today.viewAll')}</button>
            </>
          )}
        </span>
      </div>
      {meals.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, padding: '2px 2px 4px' }}>{t('today.noMeals')}</p>
      ) : (
        <section className="meal-list float-card" aria-label={t('today.todaysMeals')}>
          {shown.map((m) => (
            <button key={m.id} className="meal-row" type="button" onClick={() => onOpen(m)}>
              <span className="meal-mark"><AppIcon name={MEAL_ICON[m.type]} size={18} /></span>
              <span style={{ minWidth: 0 }}>
                <span className="meal-name" style={{ display: 'block' }}>{m.name}</span>
                <span className="meal-time">{t(('meal.' + m.type) as 'meal.breakfast')} · {fmt(m.createdAt)}</span>
              </span>
              <span className="meal-kcal num">{Math.round(m.calories)} {t('today.kcal')}</span>
            </button>
          ))}
        </section>
      )}
    </>
  )
}
