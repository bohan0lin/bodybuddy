import { suggestMeal } from './lib/ai'

export const maxDuration = 60

// Vercel Serverless Function：POST /api/suggest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await suggestMeal(body)
    res.status(200).json(result)
  } catch (e) {
    console.error('suggest error', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'AI 服务出错' })
  }
}
