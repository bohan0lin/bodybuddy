import { embedMany } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@supabase/supabase-js'

// 服务端 Supabase 客户端（读 foods 表用 anon 即可，RLS 允许 select）
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const sb = createClient(url, anon, { auth: { persistSession: false } })

export interface FoodMatch {
  query: string
  matched: boolean // 距离足够近才算命中
  name: string
  nameEn: string | null
  unit: string
  baseAmount: number
  protein: number
  carbs: number
  fat: number
  calories: number
  distance: number
}

// 余弦距离阈值：越小越接近；≤ 阈值视为可信命中
const THRESHOLD = 0.45

export async function lookupFoods(names: string[]): Promise<(FoodMatch | null)[]> {
  const cleaned = names.map((n) => (n || '').trim()).filter(Boolean)
  if (!cleaned.length || !url || !anon) return names.map(() => null)

  const { embeddings } = await embedMany({
    model: google.textEmbedding('gemini-embedding-001'),
    values: cleaned,
    providerOptions: { google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' } },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const one = async (emb: number[], query: string): Promise<FoodMatch | null> => {
    const { data, error } = await sb.rpc('match_foods', { query_embedding: emb, match_count: 1 })
    if (error || !data || !data.length) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = data[0] as any
    return {
      query,
      matched: Number(m.distance) <= THRESHOLD,
      name: m.name,
      nameEn: m.name_en ?? null,
      unit: m.unit,
      baseAmount: Number(m.base_amount),
      protein: Number(m.protein),
      carbs: Number(m.carbs),
      fat: Number(m.fat),
      calories: Number(m.calories),
      distance: Number(m.distance),
    }
  }

  return Promise.all(embeddings.map((emb, i) => one(emb as number[], cleaned[i])))
}
