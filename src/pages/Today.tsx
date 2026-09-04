import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { dateOffset, macrosByDate, sumMacros, todayStr, weekdayOf } from '../lib/nutrition'
import { useT } from '../lib/i18n'
import AppIcon from '../components/AppIcon'
import DailySummaryCarousel from '../components/DailySummaryCarousel'
import MealCapturePanel from '../components/MealCapturePanel'
import SevenDayStrip, { type StripDay } from '../components/SevenDayStrip'
import TodayMeals from '../components/TodayMeals'
import type { Meal } from '../types'

export default function Today() {
  const { meals, profile, workouts } = useStore()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const today = todayStr()

  const todayMeals = useMemo(
    () => meals.filter((m) => m.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [meals, today],
  )
  const totals = useMemo(() => sumMacros(todayMeals), [todayMeals])
  const byDate = useMemo(() => macrosByDate(meals), [meals])
  const workoutDates = useMemo(() => new Set(workouts.map((w) => w.date)), [workouts])
  const todayWorkouts = useMemo(
    () => workouts.filter((w) => w.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [workouts, today],
  )

  const weekdayLetters = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const week = useMemo<StripDay[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = dateOffset(i - 6)
        const m = byDate.get(date) ?? { protein: 0, carbs: 0, fat: 0, calories: 0 }
        return { date, calories: m.calories, isToday: date === today, wd: weekdayLetters[weekdayOf(date)], hasWorkout: workoutDates.has(date) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byDate, today, lang, workoutDates],
  )

  const targets = { protein: profile.targetProtein, carbs: profile.targetCarbs, fat: profile.targetFat, calories: profile.targetCalories }

  const dateLabel =
    lang === 'zh'
      ? new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
      : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()

  const openMeal = (m: Meal) => navigate('/log', { state: { editMeal: m, returnTo: '/' } })

  return (
    <div className="page">
      <header className="today-header">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>{dateLabel}</p>
          <h1>{t('today.heading')}</h1>
        </div>
        <button className="icon-btn" onClick={() => navigate('/calendar')} aria-label={t('nav.calendar')}>
          <AppIcon name="calendar" size={19} />
        </button>
      </header>

      <DailySummaryCarousel
        targets={targets}
        consumed={totals}
        todayWorkouts={todayWorkouts}
        onLogWorkout={() => navigate('/workout', { state: { returnTo: '/' } })}
      />

      <MealCapturePanel />

      <div className="section-title">
        <strong>{t('today.last7')}</strong>
        <button className="link" type="button" onClick={() => navigate('/calendar')}>{t('today.fullCalendar')}</button>
      </div>
      <SevenDayStrip days={week} target={profile.targetCalories} label={t('today.last7')} onDay={(d) => navigate('/day/' + d, { state: { back: '/' } })} />

      <TodayMeals meals={todayMeals} onOpen={openMeal} onViewAll={() => navigate('/day/' + today, { state: { back: '/' } })} />
    </div>
  )
}
