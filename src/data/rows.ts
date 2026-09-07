import { GOAL_TYPES, MEAL_TYPES, type KnowledgeItem, type Meal, type Profile, type SavedItem, type WeightLog, type Workout } from '../types'
import { ACTIVITY_TYPES } from '../lib/workout'
import type { DatabaseRow } from '../lib/database'

function checkedEnum<T extends string>(value: string, allowed: readonly T[]): T {
  const result = allowed.find((item) => item === value)
  if (result === undefined) throw new Error('Unrecognized database enum value')
  return result
}
export const toWeight = (r: DatabaseRow<'weight_logs'>): WeightLog => ({ id: r.id, date: r.date, weight: Number(r.weight), bodyFat: r.body_fat ?? undefined })
export const toMeal = (r: DatabaseRow<'meals'>): Meal => ({
  id: r.id,
  date: r.date,
  type: checkedEnum(r.type, MEAL_TYPES),
  name: r.name,
  brand: r.brand ?? undefined,
  amount: r.amount ?? undefined,
  unit: r.unit ?? undefined,
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  calories: Number(r.calories),
  photoUrl: r.photo_url ?? undefined,
  createdAt: r.created_at ?? '',
})
export const toSaved = (r: DatabaseRow<'saved_items'>): SavedItem => ({
  id: r.id,
  kind: checkedEnum(r.kind, ['food', 'meal'] as const),
  name: r.name,
  brand: r.brand ?? undefined,
  createdAt: r.created_at ?? undefined,
  unit: r.unit,
  baseAmount: Number(r.base_amount),
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  calories: Number(r.calories),
  photoUrl: r.photo_url ?? undefined,
  note: r.note ?? undefined,
})
export const toWorkout = (r: DatabaseRow<'workouts'>): Workout => ({
  id: r.id,
  date: r.date,
  type: checkedEnum(r.type, ACTIVITY_TYPES.map((activity) => activity.key)),
  note: r.note ?? undefined,
  durationMin: Number(r.duration_min),
  calories: Number(r.calories),
  createdAt: r.created_at ?? '',
})
export const toKnowledge = (r: DatabaseRow<'knowledge'>): KnowledgeItem => ({
  id: r.id,
  title: r.title,
  content: r.content,
  tags: r.tags ?? undefined,
  createdAt: r.created_at ?? undefined,
})
export const toProfile = (r: DatabaseRow<'profiles'>): Profile => ({
  displayName: r.display_name,
  heightCm: Number(r.height_cm),
  targetProtein: Number(r.target_protein),
  targetCarbs: Number(r.target_carbs),
  targetFat: Number(r.target_fat),
  targetCalories: Number(r.target_calories),
  goalType: r.goal_type == null ? undefined : checkedEnum(r.goal_type, GOAL_TYPES),
})
