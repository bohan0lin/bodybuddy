import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { KnowledgeItem, Meal, Profile, SavedItem, WeightLog, Workout } from '../types'
import { estimateCalories } from '../lib/nutrition'
import { supabase } from '../lib/supabase'

// ── Supabase 数据层 ───────────────────────────────────────────
// 登录后按用户拉取数据存入内存，操作时乐观更新本地并写回云端。
// 对页面暴露的接口与之前的本地版一致。

const DEFAULT_PROFILE: Profile = {
  displayName: '我',
  heightCm: 0,
  targetProtein: 0,
  targetCarbs: 0,
  targetFat: 0,
  targetCalories: 0,
}

interface AppData {
  profile: Profile
  weightLogs: WeightLog[]
  meals: Meal[]
  savedItems: SavedItem[]
  workouts: Workout[]
  knowledgeItems: KnowledgeItem[]
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
  createdAt: r.created_at ?? undefined,
  unit: r.unit,
  baseAmount: Number(r.base_amount),
  protein: Number(r.protein),
  carbs: Number(r.carbs),
  fat: Number(r.fat),
  calories: Number(r.calories),
  note: r.note ?? undefined,
})
const toWorkout = (r: any): Workout => ({
  id: r.id,
  date: r.date,
  type: r.type,
  note: r.note ?? undefined,
  durationMin: Number(r.duration_min),
  calories: Number(r.calories),
  createdAt: r.created_at,
})
const toKnowledge = (r: any): KnowledgeItem => ({
  id: r.id,
  title: r.title,
  content: r.content,
  tags: r.tags ?? undefined,
  createdAt: r.created_at ?? undefined,
})
const toProfile = (r: any): Profile => ({
  displayName: r.display_name,
  heightCm: Number(r.height_cm),
  targetProtein: Number(r.target_protein),
  targetCarbs: Number(r.target_carbs),
  targetFat: Number(r.target_fat),
  targetCalories: Number(r.target_calories),
  goalType: r.goal_type ?? undefined,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

function uid(): string {
  return crypto.randomUUID()
}

interface StoreValue extends AppData {
  loading: boolean
  addMeal: (m: Omit<Meal, 'id' | 'createdAt'>) => void
  updateMeal: (id: string, patch: Partial<Omit<Meal, 'id' | 'createdAt'>>) => void
  deleteMeal: (id: string) => void
  upsertWeight: (w: Omit<WeightLog, 'id'>) => void
  updateProfile: (p: Partial<Profile>) => void
  addSavedItem: (s: Omit<SavedItem, 'id'>) => void
  updateSavedItem: (id: string, patch: Partial<Omit<SavedItem, 'id'>>) => void
  deleteSavedItem: (id: string) => void
  addWorkout: (w: Omit<Workout, 'id' | 'createdAt'>) => void
  updateWorkout: (id: string, patch: Partial<Omit<Workout, 'id' | 'createdAt'>>) => void
  deleteWorkout: (id: string) => void
  addKnowledge: (k: { title: string; content: string; tags?: string }) => void
  deleteKnowledge: (id: string) => void
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
    workouts: [],
    knowledgeItems: [],
  })
  const [loading, setLoading] = useState(true)

  // 登录后拉取该用户全部数据
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [prof, weights, meals, saved, workouts, knowledge] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('weight_logs').select('*').eq('user_id', userId),
        supabase.from('meals').select('*').eq('user_id', userId),
        supabase.from('saved_items').select('*').eq('user_id', userId),
        supabase.from('workouts').select('*').eq('user_id', userId),
        supabase.from('knowledge').select('*').eq('user_id', userId),
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
        savedItems: (saved.data ?? [])
          .map(toSaved)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
        workouts: (workouts.data ?? []).map(toWorkout),
        knowledgeItems: (knowledge.data ?? [])
          .map(toKnowledge)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
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

      updateMeal: (id, patch) => {
        setData((d) => ({ ...d, meals: d.meals.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
        const row: Record<string, unknown> = {}
        if (patch.date !== undefined) row.date = patch.date
        if (patch.type !== undefined) row.type = patch.type
        if (patch.name !== undefined) row.name = patch.name
        if (patch.brand !== undefined) row.brand = patch.brand || null
        if (patch.amount !== undefined) row.amount = patch.amount ?? null
        if (patch.unit !== undefined) row.unit = patch.unit ?? null
        if (patch.protein !== undefined) row.protein = patch.protein
        if (patch.carbs !== undefined) row.carbs = patch.carbs
        if (patch.fat !== undefined) row.fat = patch.fat
        if (patch.calories !== undefined) row.calories = patch.calories
        supabase.from('meals').update(row).eq('id', id).then(({ error }) => error && console.error('updateMeal', error))
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
        if (p.goalType !== undefined) patch.goal_type = p.goalType
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
          const item: SavedItem = { ...s, id: uid(), createdAt: new Date().toISOString() }
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

      addWorkout: (w) => {
        const workout: Workout = { ...w, id: uid(), createdAt: new Date().toISOString() }
        setData((d) => ({ ...d, workouts: [...d.workouts, workout] }))
        supabase
          .from('workouts')
          .insert({
            id: workout.id,
            user_id: userId,
            date: workout.date,
            type: workout.type,
            note: workout.note ?? null,
            duration_min: workout.durationMin,
            calories: workout.calories,
          })
          .then(({ error }) => error && console.error('addWorkout', error))
      },

      updateWorkout: (id, patch) => {
        setData((d) => ({ ...d, workouts: d.workouts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
        const row: Record<string, unknown> = {}
        if (patch.date !== undefined) row.date = patch.date
        if (patch.type !== undefined) row.type = patch.type
        if (patch.note !== undefined) row.note = patch.note || null
        if (patch.durationMin !== undefined) row.duration_min = patch.durationMin
        if (patch.calories !== undefined) row.calories = patch.calories
        supabase.from('workouts').update(row).eq('id', id).then(({ error }) => error && console.error('updateWorkout', error))
      },

      deleteWorkout: (id) => {
        setData((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== id) }))
        supabase.from('workouts').delete().eq('id', id).then(({ error }) => error && console.error('deleteWorkout', error))
      },

      addKnowledge: (k) => {
        setData((d) => {
          // 同标题视为同一条 → 更新；否则新增
          const idx = d.knowledgeItems.findIndex((x) => x.title === k.title)
          if (idx >= 0) {
            const existing = d.knowledgeItems[idx]
            const next = [...d.knowledgeItems]
            next[idx] = { ...existing, content: k.content, tags: k.tags }
            supabase
              .from('knowledge')
              .update({ content: k.content, tags: k.tags ?? null })
              .eq('id', existing.id)
              .then(({ error }) => error && console.error('updateKnowledge', error))
            return { ...d, knowledgeItems: next }
          }
          const item: KnowledgeItem = { id: uid(), title: k.title, content: k.content, tags: k.tags, createdAt: new Date().toISOString() }
          supabase
            .from('knowledge')
            .insert({ id: item.id, user_id: userId, title: item.title, content: item.content, tags: item.tags ?? null })
            .then(({ error }) => error && console.error('addKnowledge', error))
          return { ...d, knowledgeItems: [item, ...d.knowledgeItems] }
        })
      },

      deleteKnowledge: (id) => {
        setData((d) => ({ ...d, knowledgeItems: d.knowledgeItems.filter((x) => x.id !== id) }))
        supabase.from('knowledge').delete().eq('id', id).then(({ error }) => error && console.error('deleteKnowledge', error))
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
