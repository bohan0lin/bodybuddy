import { supabase } from './supabase'
import type { Meal } from '../types'

export type FoodDraft = Pick<Meal, 'name' | 'brand' | 'protein' | 'carbs' | 'fat' | 'calories'> & { amount: number; unit: string }

export function combineFoods(items: FoodDraft[]): FoodDraft | null {
  if (!items.length) return null
  if (items.length === 1) return { ...items[0] }
  return {
    name: items.map((item) => item.name).join(' + ').slice(0, 200), amount: 1, unit: 'serving',
    ...items.reduce((sum, item) => ({
      protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat, calories: sum.calories + item.calories,
    }), { protein: 0, carbs: 0, fat: 0, calories: 0 }),
  }
}

export function scaleFood(food: FoodDraft, amount: number): FoodDraft {
  const ratio = amount / food.amount
  return { ...food, amount, protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10, fat: Math.round(food.fat * ratio * 10) / 10,
    calories: Math.round(food.calories * ratio) }
}

export async function uploadFoodPhoto(dataUrl: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Please sign in again.')
  const path = `${data.user.id}/${crypto.randomUUID()}.jpg`
  const blob = await (await fetch(dataUrl)).blob()
  const result = await supabase.storage.from('food-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (result.error) throw new Error('Photo upload failed. Please retry.')
  return path
}

export async function recordFoodEntry(id: string, meal: Omit<Meal, 'id' | 'createdAt'>, favorite: boolean): Promise<void> {
  const { error } = await supabase.rpc('record_food_entry', { p_id: id, p_meal: { ...meal }, p_favorite: favorite })
  if (error) throw new Error('Could not save this meal. Please retry.')
}
