import type { Macros, Meal } from '../types'

// 日期工具：本地时区的 YYYY-MM-DD
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

// 根据宏量素估算卡路里（蛋白4 / 碳水4 / 脂肪9）
export function estimateCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9)
}

// 汇总某天所有餐的宏量素
export function sumMacros(meals: Meal[]): Macros {
  return meals.reduce<Macros>(
    (acc, m) => ({
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      calories: acc.calories + m.calories,
    }),
    { protein: 0, carbs: 0, fat: 0, calories: 0 },
  )
}

// 把餐食按日期汇总成 { date: Macros }
export function macrosByDate(meals: Meal[]): Map<string, Macros> {
  const map = new Map<string, Macros>()
  for (const m of meals) {
    const cur = map.get(m.date) ?? { protein: 0, carbs: 0, fat: 0, calories: 0 }
    cur.protein += m.protein
    cur.carbs += m.carbs
    cur.fat += m.fat
    cur.calories += m.calories
    map.set(m.date, cur)
  }
  return map
}

// 相对今天的偏移日期（0=今天，-1=昨天）转 YYYY-MM-DD
// 用本地日历 setDate 推移，避免固定 86400000ms 在夏令时切换日出错
export function dateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return todayStr(d)
}

// 相对某个 YYYY-MM-DD 偏移若干天（用本地日历，不受夏令时/时区跳变影响）
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return todayStr(d)
}

// YYYY-MM-DD 的星期几（0=周日）
export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay()
}

export function pct(value: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

// 保留一位小数
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// 按分量换算营养值：base 对应 baseAmount，求 amount 对应的值
export function scale(base: number, amount: number, baseAmount: number): number {
  if (baseAmount <= 0) return base
  return (base * amount) / baseAmount
}
