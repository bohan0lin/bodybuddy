// 统一的后端调用（/api/* 由 Vercel Serverless / 开发中间件提供）
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `请求失败 (${res.status})`)
  }
  return res.json() as Promise<T>
}
