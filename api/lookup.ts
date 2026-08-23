import { lookupFoods } from './lib/rag'

// Vercel Serverless Function：POST /api/lookup
// body: { name: string } → { match: FoodMatch | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const [match] = await lookupFoods([body.name])
    res.status(200).json({ match })
  } catch (e) {
    console.error('lookup error', e)
    res.status(500).json({ error: e instanceof Error ? e.message : '查询出错' })
  }
}
