// Vercel Serverless Function：POST /api/assistant
// 动态 import 依赖，使导入期错误也能被捕获并返回（而非 FUNCTION_INVOCATION_FAILED）
export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { assistantChat } = await import('./lib/assistant')
    const result = await assistantChat(body)
    res.status(200).json(result)
  } catch (e) {
    console.error('assistant error', e)
    const detail = e instanceof Error ? e.stack || e.message : String(e)
    res.status(500).json({ error: detail })
  }
}
