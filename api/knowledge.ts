// Vercel Serverless Function：POST /api/knowledge
// 把口述文本整理成一条健身知识（标题/正文/标签），客户端确认后自行写库
export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { tidyKnowledge } = await import('./lib/knowledge.js')
    const result = await tidyKnowledge(body.text, body.lang)
    res.status(200).json(result)
  } catch (e) {
    console.error('knowledge error', e)
    const detail = e instanceof Error ? e.stack || e.message : String(e)
    res.status(500).json({ error: detail })
  }
}
