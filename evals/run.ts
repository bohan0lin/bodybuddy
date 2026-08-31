/* BodyBuddy AI 评测台
 * 用法：
 *   npm run eval            跑全部（lookup + assistant）
 *   npm run eval -- lookup      只跑「名字查营养(RAG)」
 *   npm run eval -- assistant   只跑「助手工具调用」
 * 需要环境变量：GOOGLE_GENERATIVE_AI_API_KEY、VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY
 * 低于阈值以退出码 1 结束（CI 会显示红，但默认不阻止合并）。
 */
import { loadEnvLocal } from './env'
import { lookupCases, assistantCases, assistantContext } from './cases'

loadEnvLocal()

const PASS_THRESHOLD = 0.8 // 每个套件通过率阈值
const CALL_GAP_MS = 900 // 每次模型调用之间的间隔，缓解免费额度限流

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const inRange = (v: unknown, [lo, hi]: [number, number]) => typeof v === 'number' && v >= lo && v <= hi

interface Row {
  name: string
  pass: boolean
  detail: string
}

function printSuite(title: string, rows: Row[]): number {
  const passed = rows.filter((r) => r.pass).length
  const rate = rows.length ? passed / rows.length : 1
  console.log(`\n━━ ${title} ── ${passed}/${rows.length} 通过（${(rate * 100).toFixed(0)}%）`)
  for (const r of rows) console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : `  → ${r.detail}`}`)
  return rate
}

async function runLookup(): Promise<number> {
  const { lookupFoods } = await import('../api/lib/rag')
  const rows: Row[] = []
  for (const c of lookupCases) {
    const [m] = await lookupFoods([c.query])
    let pass: boolean
    let detail: string
    if (c.expectNoMatch) {
      pass = !m || !m.matched
      detail = m ? `误命中 ${m.name} (d=${m.distance.toFixed(2)})` : 'ok'
    } else {
      pass = !!m && m.matched && m.name === c.expect
      detail = m ? `得到 ${m.name} (d=${m.distance.toFixed(2)})，期望 ${c.expect}` : `无命中，期望 ${c.expect}`
    }
    rows.push({ name: `「${c.query}」`, pass, detail })
    await sleep(CALL_GAP_MS)
  }
  return printSuite('2 · 名字查营养（向量RAG）', rows)
}

async function runAssistant(): Promise<number> {
  const { assistantChat } = await import('../api/lib/assistant')
  const rows: Row[] = []
  for (const c of assistantCases) {
    let pass = false
    let detail = ''
    try {
      const { actions } = await assistantChat({ messages: [{ role: 'user', text: c.text }], context: assistantContext, lang: 'zh' })
      if (c.action === null) {
        pass = actions.length === 0
        detail = pass ? 'ok' : `不该调工具，却调了 ${actions.map((a) => a.type).join(',')}`
      } else {
        const a = actions.find((x) => x.type === c.action)
        if (!a) {
          detail = `期望动作 ${c.action}，实际 ${actions.map((x) => x.type).join(',') || '无'}`
        } else {
          pass = true
          if (c.nameIncludes && !(a.name ?? '').includes(c.nameIncludes)) { pass = false; detail = `name「${a.name}」不含「${c.nameIncludes}」` }
          if (pass && c.protein && !inRange(a.protein, c.protein)) { pass = false; detail = `蛋白 ${a.protein} 不在 [${c.protein}]` }
          if (pass && c.durationMin && !inRange(a.durationMin, c.durationMin)) { pass = false; detail = `时长 ${a.durationMin} 不在 [${c.durationMin}]` }
          if (pass) detail = 'ok'
        }
      }
    } catch (e) {
      detail = `调用出错：${e instanceof Error ? e.message : e}`
    }
    rows.push({ name: `「${c.text}」`, pass, detail })
    await sleep(CALL_GAP_MS)
  }
  return printSuite('3 · 助手工具调用', rows)
}

// ── 主流程 ────────────────────────────────────────────────
const only = process.argv.slice(2).map((s) => s.toLowerCase())
const wants = (name: string) => only.length === 0 || only.includes(name)

const rates: { suite: string; rate: number }[] = []
if (wants('lookup')) rates.push({ suite: 'lookup', rate: await runLookup() })
if (wants('assistant')) rates.push({ suite: 'assistant', rate: await runAssistant() })

console.log('\n────────────────────────────')
let failed = false
for (const r of rates) {
  const ok = r.rate >= PASS_THRESHOLD
  if (!ok) failed = true
  console.log(`${ok ? '✅' : '❌'} ${r.suite}: ${(r.rate * 100).toFixed(0)}%（阈值 ${PASS_THRESHOLD * 100}%）`)
}
if (rates.length === 0) console.log('没有匹配的套件，可用：lookup / assistant')
process.exitCode = failed ? 1 : 0
