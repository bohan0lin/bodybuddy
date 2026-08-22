import { recognizeFood } from './lib/ai'

// Vercel Serverless Function：POST /api/recognize
// body: { image: base64字符串, mediaType: 'image/jpeg' ... }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await recognizeFood(body.image, body.mediaType)
    res.status(200).json(result)
  } catch (e) {
    console.error('recognize error', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'AI 识别出错' })
  }
}
