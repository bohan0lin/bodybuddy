import { shiftDate } from './nutrition'

// 「记录了」的一天：有餐或有运动。连续记录天数从今天往回数；
// 今天为空但昨天有记录时，允许 streak 结束在昨天（不因当天还没记而清零）。
export function trackingStreak(tracked: Set<string>, today: string): number {
  let n = 0
  let i = tracked.has(today) ? 0 : -1
  while (tracked.has(shiftDate(today, i))) {
    n++
    i--
  }
  return n
}

// 某月内有记录的不同天数（monthPrefix 形如 "2026-09"）
export function distinctDaysInMonth(dates: string[], monthPrefix: string): number {
  return new Set(dates.filter((d) => d.startsWith(monthPrefix))).size
}

// BMI；数据缺失或非正数返回 null（绝不把 0 当真实测量）
export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || weightKg <= 0 || !heightCm || heightCm <= 0) return null
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
}
