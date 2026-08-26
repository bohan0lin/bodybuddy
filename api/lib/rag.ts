import { embedMany } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

// 懒加载 Supabase 客户端；环境变量缺失时返回 null（绝不在模块加载期抛错）
let _sb: SupabaseClient | null | undefined
function getClient(): SupabaseClient | null {
  if (_sb !== undefined) return _sb
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  _sb = url && anon ? createClient(url, anon, { auth: { persistSession: false } }) : null
  return _sb
}

// 返回与 names 等长的匹配结果；任何异常/未配置/无数据都返回 null（调用方保留原估算）
export async function lookupFoods(names: string[]): Promise<(FoodMatch | null)[]> {
  const empty = names.map(() => null)
  const cleaned = names.map((n) => (n || '').trim())
  const hasQuery = cleaned.some(Boolean)
  const sb = getClient()
  if (!hasQuery || !sb) return empty

  try {
    const { embeddings } = await embedMany({
      model: google.textEmbedding('gemini-embedding-001'),
      values: cleaned.map((n) => n || ' '),
      providerOptions: { google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' } },
    })

    const one = async (emb: number[], query: string): Promise<FoodMatch | null> => {
      if (!query) return null
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

    return await Promise.all(embeddings.map((emb, i) => one(emb as number[], cleaned[i])))
  } catch (e) {
    console.error('lookupFoods failed', e)
    return empty
  }
}
