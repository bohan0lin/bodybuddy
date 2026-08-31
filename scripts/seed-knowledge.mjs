// 批量导入健身/营养知识（每人一份，无向量）
// 运行： node --env-file=.env.local scripts/seed-knowledge.mjs
// 需要 .env.local 里有：
//   VITE_SUPABASE_URL              （项目地址）
//   SUPABASE_SERVICE_ROLE_KEY      （服务端密钥，绕过 RLS 写入；sb_secret_ 开头）
//   SEED_USER_ID                   （把这批知识归属到哪个用户；你的账号 uid）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.SEED_USER_ID
if (!url || !serviceKey) {
  console.error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!userId) {
  console.error('缺少 SEED_USER_ID（你的账号 uid，用于归属这批知识）')
  process.exit(1)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

const items = JSON.parse(readFileSync(new URL('./knowledge.json', import.meta.url), 'utf8'))
console.log(`读取 ${items.length} 条知识`)

const rows = items.map((k) => ({
  user_id: userId,
  title: k.title,
  content: k.content,
  tags: k.tags || null,
}))

// 追加/更新：按 (user_id, title) 去重，不清空整表
console.log('写入中（upsert）…')
const { error } = await sb.from('knowledge').upsert(rows, { onConflict: 'user_id,title' })
if (error) {
  console.error('写入失败：', error.message)
  process.exit(1)
}

console.log(`✅ 完成，导入/更新 ${rows.length} 条知识`)
