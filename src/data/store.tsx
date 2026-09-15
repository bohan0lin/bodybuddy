import { toWeight, toMeal, toSaved, toWorkout, toKnowledge, toProfile } from './rows'
import type { DatabaseUpdate } from '../lib/database'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { type KnowledgeItem, type Meal, type Profile, type SavedItem, type WeightLog, type Workout } from '../types'
import { hasHydrationError, shouldInsertDefaultProfile } from '../lib/hydration'
import { supabase } from '../lib/supabase'
import { insertRecord, withRecordTimeout } from '../lib/recordMutations'

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

interface StoreValue extends AppData {
  loading: boolean
  hydrationError: boolean
  reload: () => void
  refreshRecords: () => Promise<void>
  addMeal: (m: Omit<Meal, 'id' | 'createdAt'>, id: string) => Promise<void>
  updateMeal: (id: string, patch: Partial<Omit<Meal, 'id' | 'createdAt'>>) => Promise<void>
  deleteMeal: (id: string) => Promise<void>
  upsertWeight: (w: Omit<WeightLog, 'id'>) => Promise<void>
  updateProfile: (p: Partial<Profile>) => Promise<void>
  updateSavedItem: (id: string, patch: Partial<Omit<SavedItem, 'id'>>) => Promise<void>
  deleteSavedItem: (id: string) => Promise<void>
  addWorkout: (w: Omit<Workout, 'id' | 'createdAt'>, id: string) => Promise<void>
  updateWorkout: (id: string, patch: Partial<Omit<Workout, 'id' | 'createdAt'>>) => Promise<void>
  deleteWorkout: (id: string) => Promise<void>
  addKnowledge: (k: { title: string; content: string; tags?: string }, id: string) => Promise<void>
  updateKnowledge: (id: string, k: { title: string; content: string; tags?: string }) => Promise<void>
  deleteKnowledge: (id: string) => Promise<void>
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
  const [hydrationError, setHydrationError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const refreshSequence = useRef(0)
  const pendingRecords = useRef(new Map<string, { signature: string; promise: Promise<void> }>())
  const mutateRecord = useCallback((key: string, signature: string, work: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    const pending = pendingRecords.current.get(key)
    if (pending) return pending.signature === signature ? pending.promise : Promise.reject(new Error('Record is busy'))
    ++refreshSequence.current
    const promise = Promise.resolve().then(() => withRecordTimeout(work)).finally(() => {
      ++refreshSequence.current
      pendingRecords.current.delete(key)
    })
    pendingRecords.current.set(key, { signature, promise })
    return promise
  }, [])
  const refreshRecords = useCallback(async () => {
    const sequence = ++refreshSequence.current
    const [meals, workouts, saved] = await Promise.all([
      supabase.from('meals').select('*').eq('user_id', userId),
      supabase.from('workouts').select('*').eq('user_id', userId),
      supabase.from('saved_items').select('*').eq('user_id', userId),
    ])
    if (meals.error || workouts.error || saved.error) throw new Error('Record refresh failed')
    if (sequence === refreshSequence.current && pendingRecords.current.size === 0) setData(current => ({ ...current, meals: meals.data.map(toMeal), workouts: workouts.data.map(toWorkout), savedItems: saved.data.map(toSaved) }))
  }, [userId])

  // 登录后拉取该用户全部数据
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setHydrationError(false)
      try {
        const [prof, weights, meals, saved, workouts, knowledge] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('weight_logs').select('*').eq('user_id', userId),
          supabase.from('meals').select('*').eq('user_id', userId),
          supabase.from('saved_items').select('*').eq('user_id', userId),
          supabase.from('workouts').select('*').eq('user_id', userId),
          supabase.from('knowledge').select('*').eq('user_id', userId),
        ])
        if (!alive) return

        // 任一查询出错都视为水合失败：不渲染受保护路由、给出重试，绝不把错误当成空数据
        if (hasHydrationError([prof.error, weights.error, meals.error, saved.error, workouts.error, knowledge.error])) {
          console.error('store hydration failed', { prof: prof.error, weights: weights.error, meals: meals.error, saved: saved.error, workouts: workouts.error, knowledge: knowledge.error })
          setHydrationError(true)
          setLoading(false)
          return
        }

        // 仅在「确认无该行」（查询成功且 data 为空）时才创建默认资料
        let profile = prof.data ? toProfile(prof.data) : DEFAULT_PROFILE
        if (shouldInsertDefaultProfile(prof)) {
          const created = await supabase.from('profiles').insert({
            id: userId, target_protein: 0, target_carbs: 0, target_fat: 0, target_calories: 0,
          }).select('*').single()
          if (!alive) return
          if (created.error || !created.data) throw new Error('Profile creation failed')
          profile = toProfile(created.data)
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
      } catch {
        if (!alive) return
        setHydrationError(true)
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId, reloadKey])

  const value = useMemo<StoreValue>(() => {
    const sortedWeights = [...data.weightLogs].sort((a, b) => a.date.localeCompare(b.date))
    return {
      ...data,
      loading,
      hydrationError,
      reload,
      refreshRecords,

      addMeal: (m, id) => mutateRecord(`meals:${id}`, JSON.stringify(['create', m]), async signal => {
        const meal = m
        const saved = await insertRecord('meals', {
            id,
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
            photo_url: meal.photoUrl ?? null,
          }, signal)
        const confirmed = toMeal(saved)
        setData(d => ({ ...d, meals: [...d.meals.filter(x => x.id !== id), confirmed] }))
      }),

      updateMeal: (id, patch) => mutateRecord(`meals:${id}`, JSON.stringify(['update', patch]), async signal => {
        const row: DatabaseUpdate<'meals'> = {}
        if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl || null
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
        const result = await supabase.from('meals').update(row).eq('id', id).eq('user_id', userId).select('*').abortSignal(signal).single()
        if (result.error || !result.data) throw new Error('Meal update failed')
        const confirmed = toMeal(result.data)
        setData(d => ({ ...d, meals: d.meals.map(x => x.id === id ? confirmed : x) }))
      }),

      deleteMeal: (id) => mutateRecord(`meals:${id}`, 'delete', async signal => {
        const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', userId).abortSignal(signal)
        if (error) throw new Error('Meal deletion failed')
        setData(d => ({ ...d, meals: d.meals.filter(x => x.id !== id) }))
      }),

      upsertWeight: async (w) => {
        const { data: saved, error } = await supabase
          .from('weight_logs')
          .upsert(
            { user_id: userId, date: w.date, weight: w.weight, body_fat: w.bodyFat ?? null },
            { onConflict: 'user_id,date' },
          )
          .select('*')
          .single()
        if (error) throw error
        const row = toWeight(saved)
        setData((d) => ({ ...d, weightLogs: [...d.weightLogs.filter((x) => x.date !== w.date), row] }))
      },

      // 乐观更新 + 等待云端结果；失败则回滚并抛出，供页面显示错误、避免「假成功」
      updateProfile: async (p) => {
        let prevProfile: Profile | null = null
        setData((d) => {
          prevProfile = d.profile
          return { ...d, profile: { ...d.profile, ...p } }
        })
        const patch: DatabaseUpdate<'profiles'> = {}
        if (p.displayName !== undefined) patch.display_name = p.displayName
        if (p.heightCm !== undefined) patch.height_cm = p.heightCm
        if (p.targetProtein !== undefined) patch.target_protein = p.targetProtein
        if (p.targetCarbs !== undefined) patch.target_carbs = p.targetCarbs
        if (p.targetFat !== undefined) patch.target_fat = p.targetFat
        if (p.targetCalories !== undefined) patch.target_calories = p.targetCalories
        if (p.goalType !== undefined) patch.goal_type = p.goalType
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
        if (error) {
          console.error('updateProfile', error)
          if (prevProfile) setData((d) => ({ ...d, profile: prevProfile as Profile }))
          throw error
        }
      },

      updateSavedItem: (id, patch) => mutateRecord(`saved_items:${id}`, JSON.stringify(['update', patch]), async signal => {
        const row: DatabaseUpdate<'saved_items'> = {}
        if ('photoUrl' in patch) row.photo_url = patch.photoUrl || null
        if (patch.kind !== undefined) row.kind = patch.kind
        if (patch.name !== undefined) row.name = patch.name
        if ('brand' in patch) row.brand = patch.brand || null
        if (patch.unit !== undefined) row.unit = patch.unit
        if (patch.baseAmount !== undefined) row.base_amount = patch.baseAmount
        if (patch.protein !== undefined) row.protein = patch.protein
        if (patch.carbs !== undefined) row.carbs = patch.carbs
        if (patch.fat !== undefined) row.fat = patch.fat
        if (patch.calories !== undefined) row.calories = patch.calories
        if ('note' in patch) row.note = patch.note || null
        const result = await supabase.from('saved_items').update(row).eq('id', id).eq('user_id', userId).select('*').abortSignal(signal).single()
        if (result.error || !result.data) throw new Error('Favorite update failed')
        const confirmed = toSaved(result.data)
        setData(d => ({ ...d, savedItems: d.savedItems.map(x => x.id === id ? confirmed : x) }))
      }),

      deleteSavedItem: (id) => mutateRecord(`saved_items:${id}`, 'delete', async signal => {
        const { error } = await supabase.from('saved_items').delete().eq('id', id).eq('user_id', userId).abortSignal(signal)
        if (error) throw new Error('Favorite deletion failed')
        setData(d => ({ ...d, savedItems: d.savedItems.filter(x => x.id !== id) }))
      }),

      addWorkout: (w, id) => mutateRecord(`workouts:${id}`, JSON.stringify(['create', w]), async signal => {
        const workout = w
        const saved = await insertRecord('workouts', {
            id,
            user_id: userId,
            date: workout.date,
            type: workout.type,
            note: workout.note ?? null,
            duration_min: workout.durationMin,
            calories: workout.calories,
          }, signal)
        const confirmed = toWorkout(saved)
        setData(d => ({ ...d, workouts: [...d.workouts.filter(x => x.id !== id), confirmed] }))
      }),

      updateWorkout: (id, patch) => mutateRecord(`workouts:${id}`, JSON.stringify(['update', patch]), async signal => {
        const row: DatabaseUpdate<'workouts'> = {}
        if (patch.date !== undefined) row.date = patch.date
        if (patch.type !== undefined) row.type = patch.type
        if ('note' in patch) row.note = patch.note || null
        if (patch.durationMin !== undefined) row.duration_min = patch.durationMin
        if (patch.calories !== undefined) row.calories = patch.calories
        const result = await supabase.from('workouts').update(row).eq('id', id).eq('user_id', userId).select('*').abortSignal(signal).single()
        if (result.error || !result.data) throw new Error('Workout update failed')
        const confirmed = toWorkout(result.data)
        setData(d => ({ ...d, workouts: d.workouts.map(x => x.id === id ? confirmed : x) }))
      }),

      deleteWorkout: (id) => mutateRecord(`workouts:${id}`, 'delete', async signal => {
        const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', userId).abortSignal(signal)
        if (error) throw new Error('Workout deletion failed')
        setData(d => ({ ...d, workouts: d.workouts.filter(x => x.id !== id) }))
      }),

      addKnowledge: (k, id) => mutateRecord(`knowledge:${id}`, JSON.stringify(['create', k]), async signal => {
        const saved = await insertRecord('knowledge', { id, user_id: userId, title: k.title, content: k.content, tags: k.tags || null }, signal)
        const confirmed = toKnowledge(saved)
        setData(d => ({ ...d, knowledgeItems: [confirmed, ...d.knowledgeItems.filter(x => x.id !== id)] }))
      }),

      updateKnowledge: (id, k) => mutateRecord(`knowledge:${id}`, JSON.stringify(['update', k]), async signal => {
        const result = await supabase.from('knowledge').update({ title: k.title, content: k.content, tags: k.tags || null })
          .eq('id', id).eq('user_id', userId).select('*').abortSignal(signal).single()
        if (result.error || !result.data) throw new Error('Knowledge update failed')
        const confirmed = toKnowledge(result.data)
        setData(d => ({ ...d, knowledgeItems: d.knowledgeItems.map(x => x.id === id ? confirmed : x) }))
      }),

      deleteKnowledge: (id) => mutateRecord(`knowledge:${id}`, 'delete', async signal => {
        const { error } = await supabase.from('knowledge').delete().eq('id', id).eq('user_id', userId).abortSignal(signal)
        if (error) throw new Error('Knowledge deletion failed')
        setData(d => ({ ...d, knowledgeItems: d.knowledgeItems.filter(x => x.id !== id) }))
      }),

      latestWeight: sortedWeights[sortedWeights.length - 1],
      prevWeight: sortedWeights[sortedWeights.length - 2],
    }
  }, [data, loading, hydrationError, reload, refreshRecords, mutateRecord, userId])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}
