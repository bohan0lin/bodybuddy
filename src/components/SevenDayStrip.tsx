import CalorieRing from './CalorieRing'
import AppIcon from './AppIcon'

export interface StripDay {
  date: string
  calories: number
  isToday: boolean
  wd: string
  hasWorkout: boolean
}

// 过去七天：每天一个卡路里套圈环，练过的那天在环心放一枚细线哑铃
export default function SevenDayStrip({ days, target, onDay, label }: { days: StripDay[]; target: number; onDay: (date: string) => void; label: string }) {
  return (
    <section className="week-strip float-card" aria-label={label}>
      {days.map((d) => (
        <button key={d.date} className={'week-day' + (d.isToday ? ' today' : '')} type="button" onClick={() => onDay(d.date)} aria-label={d.date}>
          <span>{d.wd}</span>
          <span className="week-ring-wrap">
            <CalorieRing calories={d.calories} target={target} size={30} stroke={3} />
            {d.hasWorkout && <AppIcon name="dumbbell" size={11} strokeWidth={2} className="week-dumbbell" />}
          </span>
        </button>
      ))}
    </section>
  )
}
