import { embedMany } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { foodMatchSchema } from './contracts.js'
import { referenceUnit, selectCandidate } from './retrieval.js'
import type { Database } from '../../src/lib/database.types.js'
import type { z } from 'zod'

export type FoodMatch = z.infer<typeof foodMatchSchema>
export interface FoodQuery { name: string; brand?: string; preparation?: string; unit?: string }
let client: SupabaseClient<Database> | null | undefined
function getClient() {
  if (client !== undefined) return client
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  client = url && key ? createClient<Database>(url, key, { auth: { persistSession: false } }) : null
  return client
}
type Candidate = { name: string; name_en: string | null; unit: string; base_amount: number; protein: number; carbs: number; fat: number; calories: number; distance: number; source: string }
function match(query: string, candidate: Candidate, method: 'exact' | 'semantic'): FoodMatch {
  return foodMatchSchema.parse({ query, matched: true, name: candidate.name, nameEn: candidate.name_en,
    unit: candidate.unit, baseAmount: Number(candidate.base_amount), protein: Number(candidate.protein),
    carbs: Number(candidate.carbs), fat: Number(candidate.fat), calories: Number(candidate.calories),
    distance: Number(candidate.distance), source: candidate.source, method })
}

// Strict mode distinguishes unavailable infrastructure from a true no-match in evals.
export async function lookupFoods(queries: (string | FoodQuery)[], abortSignal?: AbortSignal, options: { strict?: boolean; strategy?: 'hybrid' | 'vector' } = {}): Promise<(FoodMatch | null)[]> {
  const sb = getClient()
  if (!sb) { if (options.strict) throw new Error('Retrieval configuration unavailable'); return queries.map(() => null) }
  return Promise.all(queries.map(async query => {
    const q = typeof query === 'string' ? { name: query } : query
    if (!q.name.trim()) return null
    const unit = referenceUnit(q.unit)
    if (q.unit && !unit) return null
    const filters = { p_brand: q.brand, p_preparation: q.preparation, p_unit: unit }
    try {
      if (options.strategy !== 'vector') {
        const request = sb.rpc('find_foods_exact', { p_query: q.name.trim(), ...filters })
        const { data, error } = await (abortSignal ? request.abortSignal(abortSignal) : request)
        if (error) throw new Error('Exact retrieval unavailable')
        if (data?.length) {
          const selected = selectCandidate(data, true)
          return selected ? match(q.name, selected, 'exact') : null
        }
      }
      const { embeddings } = await embedMany({ model: google.textEmbedding('gemini-embedding-001'), values: [q.name], maxRetries: 0, abortSignal,
        providerOptions: { google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' } } })
      const request = sb.rpc('find_foods_semantic', { p_embedding: JSON.stringify(embeddings[0]), ...filters })
      const { data, error } = await (abortSignal ? request.abortSignal(abortSignal) : request)
      if (error) throw new Error('Semantic retrieval unavailable')
      const selected = options.strategy === 'vector' ? (data?.[0] && data[0].distance <= 0.45 ? data[0] : null) : selectCandidate(data ?? [])
      return selected ? match(q.name, selected, 'semantic') : null
    } catch (error) {
      if (options.strict || abortSignal?.aborted) throw error
      return null
    }
  }))
}
