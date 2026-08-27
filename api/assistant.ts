import { assistantChat } from './lib/assistant'

// Vercel Serverless Function：POST /api/assistant
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await assistantChat(body)
    res.status(200).json(result)
  } catch (e) {
    console.error('assistant error', e)
    res.status(500).json({ error: e instanceof Error ? e.message : '出错了' })
  }
}
