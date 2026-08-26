import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Meal, Profile, SavedItem, WeightLog } from '../types'
import { estimateCalories } from '../lib/nutrition'
import { supabase } from '../lib/supabase'

// ── Supabase 数据层 ───────────────────────────────────────────
// 登录后按用户拉取数据存入内存，操作时乐观更新本地并写回云端。
// 对页面暴露的接口与之前的本地版一致。

const DEFAULT_PROFILE: Profile = {
  displayName: '我',
  heightCm: 170,
  targetProtein: 140,
  targetCarbs: 200,
  targetFat: 60,
  targetCalories: 1900,
}

interface AppData {
  profile: Profile
  weightLogs: WeightLog[]
  meals: Meal[]
  savedItems: SavedItem[]
}

// ── 行 ⇄ 对象映射（数据库 snake_case ⇄ 前端 camelCase）──────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const toWeight = (r: any): WeightLog => ({ id: r.id, date: r.date, weight: Number(r.weight), bodyFat: r.body_fat ?? undefined })
const toMeal = (r: any): Meal => ({
  id: r.id,
  date: r.date,
  type: r.type,
  name: r.name,
  brand: r.brand ?? undefined,
  amount: r.amount ?? undefined,
  unit: r.unit ?? undefined,
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  calories: Number(r.calories),
  photoUrl: r.photo_url ?? undefined,
  createdAt: r.created_at,
})
const toSaved = (r: any): SavedItem => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  brand: r.brand ?? undefined,
  unit: r.unit,
  baseAmount: Number(r.base_amount),
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  calories: Number(r.calories),
  note: r.note ?? undefined,
})
const toProfile = (r: any): Profile => ({
  displayName: r.display_name,
  heightCm: Number(r.height_cm),
  targetProtein: Number(r.target_protein),
  targetCarbs: Number(r.target_carbs),
  targetFat: Number(r.target_fat),
  targetCalories: Number(r.target_calories),
})
/* eslint-enable @typescript-eslint/no-explicit-any */

function uid(): string {
  return crypto.randomUUID()
}

interface StoreValue extends AppData {
  loading: boolean
  addMeal: (m: Omit<Meal, 'id' | 'createdAt'>) => void
  deleteMeal: (id: string) => void
  upsertWeight: (w: Omit<WeightLog, 'id'>) => void
  updateProfile: (p: Partial<Profile>) => void
  addSavedItem: (s: Omit<SavedItem, 'id'>) => void
  updateSavedItem: (id: string, patch: Partial<Omit<SavedItem, 'id'>>) => void
  deleteSavedItem: (id: string) => void
  latestWeight: WeightLog | undefined
  prevWeight: WeightLog | undefined
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [data, setData] = useState<AppData>({
    profile: DEFAULT_PROFILE,
    weightLogs: [],
    meals: [],
    savedItems: [],
  })
  const [loading, setLoading] = useState(true)

  // 登录后拉取该用户全部数据
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [prof, weights, meals, saved] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('weight_logs').select('*').eq('user_id', userId),
        supabase.from('meals').select('*').eq('user_id', userId),
        supabase.from('saved_items').select('*').eq('user_id', userId),
      ])
      if (!alive) return

      // 若 profile 尚未创建（触发器兜底失败），插入默认
      let profile = prof.data ? toProfile(prof.data) : DEFAULT_PROFILE
      if (!prof.data) {
        await supabase.from('profiles').insert({ id: userId })
        profile = DEFAULT_PROFILE
      }

      setData({
        profile,
        weightLogs: (weights.data ?? []).map(toWeight),
        meals: (meals.data ?? []).map(toMeal),
        savedItems: (saved.data ?? []).map(toSaved),
      })
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [userId])

  const value = useMemo<StoreValue>(() => {
    const sortedWeights = [...data.weightLogs].sort((a, b) => a.date.localeCompare(b.date))
    return {
      ...data,
      loading,

      addMeal: (m) => {
        const calories = m.calories || estimateCalories(m.protein, m.carbs, m.fat)
        const meal: Meal = { ...m, calories, id: uid(), createdAt: new Date().toISOString() }
        setData((d) => ({ ...d, meals: [...d.meals, meal] }))
        supabase
          .from('meals')
          .insert({
            id: meal.id,
            user_id: userId,
            date: meal.date,
            type: meal.type,
            name: meal.name,
            brand: meal.brand ?? null,
            amount: meal.amount ?? null,
            unit: meal.unit ?? null,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            calories: meal.calories,
          })
          .then(({ error }) => error && console.error('addMeal', error))
      },

      deleteMeal: (id) => {
        setData((d) => ({ ...d, meals: d.meals.filter((x) => x.id !== id) }))
        supabase.from('meals').delete().eq('id', id).then(({ error }) => error && console.error('deleteMeal', error))
      },

      upsertWeight: (w) => {
        setData((d) => {
          const existing = d.weightLogs.find((x) => x.date === w.date)
          const id = existing?.id ?? uid()
          const row: WeightLog = { ...w, id }
          const weightLogs = existing
            ? d.weightLogs.map((x) => (x.date === w.date ? row : x))
            : [...d.weightLogs, row]
          supabase
            .from('weight_logs')
            .upsert(
              { id, user_id: userId, date: w.date, weight: w.weight, body_fat: w.bodyFat ?? null },
              { onConflict: 'user_id,date' },
            )
            .then(({ error }) => error && console.error('upsertWeight', error))
          return { ...d, weightLogs }
        })
      },

      updateProfile: (p) => {
        setData((d) => ({ ...d, profile: { ...d.profile, ...p } }))
        const patch: Record<string, unknown> = {}
        if (p.displayName !== undefined) patch.display_name = p.displayName
        if (p.heightCm !== undefined) patch.height_cm = p.heightCm
        if (p.targetProtein !== undefined) patch.target_protein = p.targetProtein
        if (p.targetCarbs !== undefined) patch.target_carbs = p.targetCarbs
        if (p.targetFat !== undefined) patch.target_fat = p.targetFat
        if (p.targetCalories !== undefined) patch.target_calories = p.targetCalories
        supabase.from('profiles').update(patch).eq('id', userId).then(({ error }) => error && console.error('updateProfile', error))
      },

      addSavedItem: (s) => {
        setData((d) => {
          // 同类同名同品牌视为同一项 → 更新；否则新增
          const idx = d.savedItems.findIndex(
            (x) => x.kind === s.kind && x.name === s.name && (x.brand ?? '') === (s.brand ?? ''),
          )
          if (idx >= 0) {
            const existing = d.savedItems[idx]
            const next = [...d.savedItems]
            next[idx] = { ...existing, ...s }
            supabase
              .from('saved_items')
              .update({
                brand: s.brand ?? null,
                unit: s.unit,
                base_amount: s.baseAmount,
                protein: s.protein,
                carbs: s.carbs,
                fat: s.fat,
                calories: s.calories,
                note: s.note ?? null,
              })
              .eq('id', existing.id)
              .then(({ error }) => error && console.error('updateSaved', error))
            return { ...d, savedItems: next }
          }
          const item: SavedItem = { ...s, id: uid() }
          supabase
            .from('saved_items')
            .insert({
              id: item.id,
              user_id: userId,
              kind: item.kind,
              name: item.name,
              brand: item.brand ?? null,
              unit: item.unit,
              base_amount: item.baseAmount,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              calories: item.calories,
              note: item.note ?? null,
            })
            .then(({ error }) => error && console.error('addSaved', error))
          return { ...d, savedItems: [item, ...d.savedItems] }
        })
      },

      updateSavedItem: (id, patch) => {
        setData((d) => ({
          ...d,
          savedItems: d.savedItems.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }))
        const row: Record<string, unknown> = {}
        if (patch.kind !== undefined) row.kind = patch.kind
        if (patch.name !== undefined) row.name = patch.name
        if (patch.brand !== undefined) row.brand = patch.brand || null
        if (patch.unit !== undefined) row.unit = patch.unit
        if (patch.baseAmount !== undefined) row.base_amount = patch.baseAmount
        if (patch.protein !== undefined) row.protein = patch.protein
        if (patch.carbs !== undefined) row.carbs = patch.carbs
        if (patch.fat !== undefined) row.fat = patch.fat
        if (patch.calories !== undefined) row.calories = patch.calories
        if (patch.note !== undefined) row.note = patch.note || null
        supabase.from('saved_items').update(row).eq('id', id).then(({ error }) => error && console.error('updateSavedItem', error))
      },

      deleteSavedItem: (id) => {
        setData((d) => ({ ...d, savedItems: d.savedItems.filter((x) => x.id !== id) }))
        supabase.from('saved_items').delete().eq('id', id).then(({ error }) => error && console.error('deleteSaved', error))
      },

      latestWeight: sortedWeights[sortedWeights.length - 1],
      prevWeight: sortedWeights[sortedWeights.length - 2],
    }
  }, [data, loading, userId])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}
