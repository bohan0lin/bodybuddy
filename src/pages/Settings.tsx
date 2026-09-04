import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { dateOffset, todayStr } from '../lib/nutrition'
import ProfileHeader from '../components/ProfileHeader'
import GoalHero from '../components/GoalHero'
import BodyMetricGrid from '../components/BodyMetricGrid'
import PreferencesSheet from '../components/PreferencesSheet'

export default function Settings() {
  const { profile, latestWeight, meals, workouts } = useStore()
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const today = todayStr()

  const name = profile.displayName?.trim() || (lang === 'zh' ? '你' : 'You')

  // 连续记录：有餐或有运动的一天算「记录了」；今天为空但昨天有则从昨天算起
  const trackedDates = useMemo(
    () => new Set<string>([...meals.map((m) => m.date), ...workouts.map((w) => w.date)]),
    [meals, workouts],
  )
  const streak = useMemo(() => {
    let n = 0
    let i = trackedDates.has(today) ? 0 : -1
    while (trackedDates.has(dateOffset(i))) {
      n++
      i--
    }
    return n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedDates, today])

  // 本月记录：记录天数 / 已过天数；运动天数（去重）
  const monthPrefix = today.slice(0, 7)
  const elapsedDays = new Date().getDate()
  const mealDays = useMemo(
    () => new Set(meals.filter((m) => m.date.startsWith(monthPrefix)).map((m) => m.date)).size,
    [meals, monthPrefix],
  )
  const workoutDaysMonth = useMemo(
    () => new Set(workouts.filter((w) => w.date.startsWith(monthPrefix)).map((w) => w.date)).size,
    [workouts, monthPrefix],
  )
  const mealPct = elapsedDays > 0 ? Math.min(100, Math.round((mealDays / elapsedDays) * 100)) : 0

  const targets = { protein: profile.targetProtein, carbs: profile.targetCarbs, fat: profile.targetFat, calories: profile.targetCalories }

  return (
    <div className="page">
      <ProfileHeader
        name={name}
        streak={streak}
        onProfile={() => navigate('/settings/profile')}
        onSettings={() => setSheetOpen(true)}
      />

      {/* goalType 在后续「可选目标类型」迁移中接入；当前退化为「每日目标」并突出真实数值 */}
      <GoalHero goalType={undefined} targets={targets} onEdit={() => navigate('/settings/targets')} />

      <BodyMetricGrid
        heightCm={profile.heightCm}
        weight={latestWeight?.weight}
        bodyFat={latestWeight?.bodyFat}
        onOpen={() => navigate('/body', { state: { back: '/settings' } })}
      />

      <section className="card">
        <div className="card-heading">{t('me.thisMonth')}</div>
        <div className="progress-row">
          <div className="progress-label">
            <span>{t('me.mealsLogged')}</span>
            <span>{t('me.ofDays', { x: mealDays, y: elapsedDays })}</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${mealPct}%` }} /></div>
        </div>
        <div className="progress-row">
          <div className="progress-label">
            <span>{t('me.workoutDays')}</span>
            <span>{t('me.daysN', { n: workoutDaysMonth })}</span>
          </div>
        </div>
      </section>

      <PreferencesSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
