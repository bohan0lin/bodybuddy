// Synthetic acceptance data. No values come from real users; dates are relative to the seed day.
export const SEED_MARKER = 'bodybuddy-staging-v1'

export function localDate(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(date, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Dates must use YYYY-MM-DD')
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

const meal = (date, type, name, amount, unit, protein, carbs, fat, calories, brand = null) =>
  ({ date, type, name, brand, amount, unit, protein, carbs, fat, calories })
const targets = { target_protein: 140, target_carbs: 220, target_fat: 60, target_calories: 2000 }

function fullMeals(today) {
  const day = [
    ['breakfast', '燕麦牛奶 Oatmeal with milk', 350, 'g', 18, 52, 9, 355],
    ['lunch', '鸡胸肉饭 Chicken rice bowl', 1, 'serving', 42, 70, 12, 560],
    ['snack', 'Greek yogurt 希腊酸奶', 150, 'g', 15, 6, 3, 110],
    ['dinner', '三文鱼沙拉 Salmon salad', 1, 'serving', 34, 18, 22, 420],
  ]
  // Six previous days are fully logged; today has breakfast and lunch only, so remaining targets are visible.
  return Array.from({ length: 7 }, (_, index) => addDays(today, -index))
    .flatMap((date, index) => (index === 0 ? day.slice(0, 2) : day).map((values) => meal(date, ...values)))
}

export function buildStagingAccounts(today) {
  addDays(today, 0)
  return [
    { label: 'empty', email: 'staging-empty@bodybuddy.test', profile: null, weight_logs: [], meals: [], workouts: [], saved_items: [], knowledge: [] },
    {
      label: 'partial', email: 'staging-partial@bodybuddy.test',
      profile: { display_name: 'Partial', ...targets },
      weight_logs: [{ date: addDays(today, -3), weight: 68.4, body_fat: null }, { date: today, weight: 68.1, body_fat: null }],
      meals: [meal(today, 'breakfast', '鸡蛋 Eggs', 2, 'serving', 12, 1, 10, 143)],
      workouts: [],
      saved_items: [{ kind: 'food', name: '鸡胸肉 Chicken breast', brand: null, unit: 'g', base_amount: 100, protein: 31, carbs: 0, fat: 3.6, calories: 165, note: null }],
      knowledge: [],
    },
    {
      label: 'full', email: 'staging-full@bodybuddy.test',
      profile: { display_name: 'Full', height_cm: 175, goal_type: 'recomposition', ...targets },
      weight_logs: Array.from({ length: 14 }, (_, index) => ({ date: addDays(today, index - 13), weight: Math.round((72 - index * 0.1) * 10) / 10, body_fat: Math.round((19 - index * 0.05) * 10) / 10 })),
      meals: fullMeals(today),
      workouts: [
        { date: addDays(today, -6), type: 'strength', note: 'Legs', duration_min: 60, calories: 350 },
        { date: addDays(today, -4), type: 'run', note: null, duration_min: 30, calories: 320 },
        { date: addDays(today, -2), type: 'strength', note: 'Upper body', duration_min: 55, calories: 320 },
        { date: addDays(today, -1), type: 'walk', note: null, duration_min: 40, calories: 150 },
      ],
      saved_items: [
        { kind: 'food', name: '鸡胸肉 Chicken breast', brand: null, unit: 'g', base_amount: 100, protein: 31, carbs: 0, fat: 3.6, calories: 165, note: null },
        { kind: 'food', name: '全脂牛奶 Whole milk', brand: 'Synthetic Dairy', unit: 'ml', base_amount: 100, protein: 3.4, carbs: 4.8, fat: 3.3, calories: 61, note: null },
        { kind: 'food', name: '米饭 Cooked rice', brand: null, unit: 'g', base_amount: 100, protein: 2.6, carbs: 28, fat: 0.3, calories: 130, note: null },
        { kind: 'food', name: 'Greek yogurt 希腊酸奶', brand: null, unit: 'g', base_amount: 100, protein: 10, carbs: 4, fat: 2, calories: 73, note: null },
        { kind: 'meal', name: '鸡胸肉饭 Chicken rice bowl', brand: null, unit: 'serving', base_amount: 1, protein: 42, carbs: 70, fat: 12, calories: 560, note: 'Chicken, rice, broccoli' },
        { kind: 'meal', name: '三文鱼沙拉 Salmon salad', brand: null, unit: 'serving', base_amount: 1, protein: 34, carbs: 18, fat: 22, calories: 420, note: 'Salmon, greens, olive oil' },
      ],
      knowledge: [
        { title: 'Protein distribution', content: 'Spread protein across three to four meals.', tags: 'protein' },
        { title: '训练后补充', content: '训练后一餐包含蛋白质和碳水。', tags: '训练,碳水' },
        { title: 'Sleep and recovery', content: 'Keep a consistent sleep schedule on training weeks.', tags: 'recovery' },
      ],
    },
  ]
}
