import { z } from 'zod'
import type { Identity } from './auth.js'
import type { AssistantContext } from './assistant.js'
import { macrosSchema, mealType, nutritionShape, saveInputSchema, workoutType } from './contracts.js'
import { ApiError } from './http.js'

const profileSchema = z.object({ target_protein: nutritionShape.protein, target_carbs: nutritionShape.carbs, target_fat: nutritionShape.fat, target_calories: nutritionShape.calories })
const mealSchema = macrosSchema.extend({ date: z.iso.date(), name: z.string().max(200), type: mealType })
const workoutSchema = z.object({ date: z.iso.date(), type: workoutType, note: z.string().max(1000).nullable(), duration_min: z.number().min(0).max(1440), calories: nutritionShape.calories })
const savedSchema = saveInputSchema.omit({ baseAmount: true, brand: true }).extend({ base_amount: z.number().positive().max(20000), brand: z.string().max(200).nullable() })
const knowledgeRow = z.object({ title: z.string().max(200), content: z.string().max(8000), tags: z.string().max(500).nullable() })
const weightSchema = z.object({ weight: z.number().positive().max(700), body_fat: z.number().min(0).max(100).nullable() })

export async function loadContext({ db, userId }: Identity, date: string, hour: number): Promise<AssistantContext> {
  const start = new Date(date + 'T00:00:00Z')
  start.setUTCDate(start.getUTCDate() - 6)
  const since = start.toISOString().slice(0, 10)
  const results = await Promise.all([
    db.from('profiles').select('target_protein,target_carbs,target_fat,target_calories').eq('id', userId).single(),
    db.from('meals').select('date,name,type,protein,carbs,fat,calories').eq('user_id', userId).gte('date', since).lte('date', date).order('date').limit(501),
    db.from('workouts').select('date,type,note,duration_min,calories').eq('user_id', userId).gte('date', since).lte('date', date).order('date').limit(501),
    db.from('saved_items').select('kind,name,brand,unit,base_amount,protein,carbs,fat,calories').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
    db.from('knowledge').select('title,content,tags').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    db.from('weight_logs').select('weight,body_fat').eq('user_id', userId).order('date', { ascending: false }).limit(1),
  ])
  if (results.some((r) => r.error)) throw new ApiError(503, 'CONTEXT_UNAVAILABLE', 'Could not load saved data. Please retry.')
  try {
    const profile = profileSchema.parse(results[0].data)
    const meals = z.array(mealSchema).max(500).parse(results[1].data)
    const workouts = z.array(workoutSchema).max(500).parse(results[2].data)
    const saved = z.array(savedSchema).max(40).parse(results[3].data)
    const knowledge = z.array(knowledgeRow).max(20).parse(results[4].data)
    const [weight] = z.array(weightSchema).max(1).parse(results[5].data)
    const total = (rows: typeof meals) => rows.reduce((sum, m) => ({ protein: sum.protein + m.protein, carbs: sum.carbs + m.carbs, fat: sum.fat + m.fat, calories: sum.calories + m.calories }), { protein: 0, carbs: 0, fat: 0, calories: 0 })
    const today = meals.filter((m) => m.date === date)
    return {
      targets: { protein: profile.target_protein, carbs: profile.target_carbs, fat: profile.target_fat, calories: profile.target_calories },
      consumed: macrosSchema.parse(total(today)),
      todayMeals: today.map(({ name, type }) => ({ name, type })),
      todayWorkouts: workouts.filter((w) => w.date === date).map((w) => ({ type: w.type, note: w.note ?? undefined, durationMin: w.duration_min, calories: w.calories })),
      recentDays: Array.from({ length: 7 }, (_, offset) => {
        const d = new Date(start)
        d.setUTCDate(d.getUTCDate() + offset)
        const key = d.toISOString().slice(0, 10)
        return { date: key, ...macrosSchema.parse(total(meals.filter((m) => m.date === key))) }
      }),
      recentWorkouts: workouts.map((w) => ({ date: w.date, type: w.type, durationMin: w.duration_min, calories: w.calories })),
      savedItems: saved.map((s) => ({ ...s, baseAmount: s.base_amount, brand: s.brand ?? undefined })),
      knowledge: knowledge.map((k) => ({ ...k, tags: k.tags ?? undefined })),
      latestWeight: weight ? { weight: weight.weight, bodyFat: weight.body_fat ?? undefined } : undefined,
      hour,
    }
  } catch {
    throw new ApiError(503, 'CONTEXT_UNAVAILABLE', 'Saved data could not be used. Please review your entries.')
  }
}
