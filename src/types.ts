// BodyBuddy 核心数据类型

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '🍱',
  dinner: '🍽️',
  snack: '🍎',
}

export interface Profile {
  displayName: string
  heightCm: number
  targetProtein: number // g
  targetCarbs: number // g
  targetFat: number // g
  targetCalories: number // kcal
}

export interface WeightLog {
  id: string
  date: string // YYYY-MM-DD
  weight: number // kg
  bodyFat?: number // %
}

export interface Meal {
  id: string
  date: string // YYYY-MM-DD
  type: MealType
  name: string
  brand?: string // 品牌，如某某牌
  amount?: number // 分量，如 150
  unit?: string // 单位，如 g / 份
  protein: number // g
  carbs: number // g
  fat: number // g
  calories: number // kcal
  photoUrl?: string
  createdAt: string // ISO
}

export interface Macros {
  protein: number
  carbs: number
  fat: number
  calories: number
}

// 常用库：可快捷复用的食物 / 套餐
export type SavedKind = 'food' | 'meal'

export interface SavedItem {
  id: string
  kind: SavedKind
  name: string
  brand?: string // 品牌，如某某牌鸡胸肉
  createdAt?: string // 用于「最近」排序
  unit: string // 计量单位：g / 份 / ml / 个 …
  baseAmount: number // 以下营养值对应的分量，如 100（表示每 100g）
  protein: number
  carbs: number
  fat: number
  calories: number
  note?: string // 套餐可记组成，如「鸡胸+米饭+西兰花」
}
