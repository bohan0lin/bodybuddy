// 导入健身/营养知识并生成向量入库
// 运行： node --env-file=.env.local scripts/seed-knowledge.mjs
// 需要 .env.local 里有：
//   GOOGLE_GENERATIVE_AI_API_KEY   （生成向量）
//   VITE_SUPABASE_URL              （项目地址）
//   SUPABASE_SERVICE_ROLE_KEY      （服务端密钥，绕过 RLS 写入；sb_secret_ 开头）
import { readFileSync } from 'node:fs'
import { embedMany } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error('缺少 GOOGLE_GENERATIVE_AI_API_KEY')
  process.exit(1)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

const items = JSON.parse(readFileSync(new URL('./knowledge.json', import.meta.url), 'utf8'))
console.log(`读取 ${items.length} 条知识`)

// 用于检索的文本：标题 + 正文 + 标签
const texts = items.map((k) => [k.title, k.content, k.tags].filter(Boolean).join('\n'))

console.log('生成向量中…')
const { embeddings } = await embedMany({
  model: google.textEmbedding('gemini-embedding-001'),
  values: texts,
  providerOptions: { google: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' } },
})
console.log(`已生成 ${embeddings.length} 个向量，维度 ${embeddings[0].length}`)

const rows = items.map((k, i) => ({
  title: k.title,
  content: k.content,
  tags: k.tags || null,
  embedding: embeddings[i],
}))

// 清空后重新导入（可重复运行）
console.log('清空旧数据…')
const { error: delErr } = await sb.from('knowledge').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (delErr) {
  console.error('删除失败：', delErr.message)
  process.exit(1)
}

console.log('写入中…')
const { error: insErr } = await sb.from('knowledge').insert(rows)
if (insErr) {
  console.error('写入失败：', insErr.message)
  process.exit(1)
}

console.log(`✅ 完成，导入 ${rows.length} 条知识到知识库`)
