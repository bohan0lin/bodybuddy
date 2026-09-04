import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { todayStr } from '../lib/nutrition'
import { distinctDaysInMonth, trackingStreak } from '../lib/insights'
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
  const streak = useMemo(() => trackingStreak(trackedDates, today), [trackedDates, today])

  // 本月记录：记录天数 / 已过天数；运动天数（去重）
  const monthPrefix = today.slice(0, 7)
  const elapsedDays = new Date().getDate()
  const mealDays = useMemo(() => distinctDaysInMonth(meals.map((m) => m.date), monthPrefix), [meals, monthPrefix])
  const workoutDaysMonth = useMemo(() => distinctDaysInMonth(workouts.map((w) => w.date), monthPrefix), [workouts, monthPrefix])
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

      <GoalHero goalType={profile.goalType} targets={targets} onEdit={() => navigate('/settings/targets')} />

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
