/* BodyBuddy AI 评测台
 * 用法：
 *   npm run eval            跑全部（lookup + assistant）
 *   npm run eval -- lookup      只跑「名字查营养(RAG)」
 *   npm run eval -- assistant   只跑「助手工具调用」
 * 需要环境变量：GOOGLE_GENERATIVE_AI_API_KEY、VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY
 * 低于阈值以退出码 1 结束（CI 显示红，但默认不阻止合并）。
 * 抗限流：遇到 429/配额自动退避重试；仍被限流则记为「跳过」（不算失败，不拉低通过率）。
 */
import { loadEnvLocal } from './env'
import { lookupCases, assistantCases, assistantContext } from './cases'

loadEnvLocal()

const PASS_THRESHOLD = 0.8 // 每个套件通过率阈值（只统计真正跑成的用例）
const CALL_GAP_MS = 4000 // 每条用例之间的间隔，缓解免费额度每分钟限流
const RATE_RE = /429|rate.?limit|quota|too many|resource.?exhausted|overload|unavailable/i

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const inRange = (v: unknown, [lo, hi]: [number, number]) => typeof v === 'number' && v >= lo && v <= hi

// 限流时退避重试；始终失败则把原错误抛出（若是限流错误，调用方据此标记为跳过）
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let last: unknown
  for (let i = 0; i < 4; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!RATE_RE.test(msg)) throw e
      const wait = 20000 * (i + 1)
      console.log(`  …被限流，${wait / 1000}s 后重试（${label}）`)
      await sleep(wait)
    }
  }
  throw last
}
const isRateLimit = (e: unknown) => RATE_RE.test(e instanceof Error ? e.message : String(e))

type Status = 'pass' | 'fail' | 'skip'
interface Row {
  name: string
  status: Status
  detail: string
}

// 返回 null 表示该套件全被限流跳过（结果不确定，不参与判定）
function printSuite(title: string, rows: Row[]): number | null {
  const passed = rows.filter((r) => r.status === 'pass').length
  const failed = rows.filter((r) => r.status === 'fail').length
  const skipped = rows.filter((r) => r.status === 'skip').length
  const scored = passed + failed
  const rate = scored ? passed / scored : null
  const rateStr = rate === null ? '—（全被限流跳过）' : `${(rate * 100).toFixed(0)}%`
  console.log(`\n━━ ${title} ── ${passed}/${scored} 通过（${rateStr}）${skipped ? `，跳过 ${skipped}` : ''}`)
  const icon = { pass: '✓', fail: '✗', skip: '∅' }
  for (const r of rows) console.log(`  ${icon[r.status]} ${r.name}${r.status === 'pass' ? '' : `  → ${r.detail}`}`)
  return rate
}

async function runLookup(): Promise<number | null> {
  const { lookupFoods } = await import('../api/lib/rag')
  const rows: Row[] = []
  for (const c of lookupCases) {
    try {
      const [m] = await withRetry(() => lookupFoods([c.query]), c.query)
      let ok: boolean
      let detail: string
      if (c.expectNoMatch) {
        ok = !m || !m.matched
        detail = m ? `误命中 ${m.name} (d=${m.distance.toFixed(2)})` : 'ok'
      } else {
        ok = !!m && m.matched && m.name === c.expect
        detail = m ? `得到 ${m.name} (d=${m.distance.toFixed(2)})，期望 ${c.expect}` : `无命中，期望 ${c.expect}`
      }
      rows.push({ name: `「${c.query}」`, status: ok ? 'pass' : 'fail', detail })
    } catch (e) {
      rows.push({ name: `「${c.query}」`, status: isRateLimit(e) ? 'skip' : 'fail', detail: `${e instanceof Error ? e.message : e}` })
    }
    await sleep(CALL_GAP_MS)
  }
  return printSuite('2 · 名字查营养（向量RAG）', rows)
}

async function runAssistant(): Promise<number | null> {
  const { assistantChat } = await import('../api/lib/assistant')
  const rows: Row[] = []
  for (const c of assistantCases) {
    try {
      const { actions } = await withRetry(
        () => assistantChat({ messages: [{ role: 'user', text: c.text }], context: assistantContext, lang: 'zh' }),
        c.text,
      )
      let ok = false
      let detail = ''
      if (c.action === null) {
        ok = actions.length === 0
        detail = ok ? 'ok' : `不该调工具，却调了 ${actions.map((a) => a.type).join(',')}`
      } else {
        const a = actions.find((x) => x.type === c.action)
        if (!a) {
          detail = `期望动作 ${c.action}，实际 ${actions.map((x) => x.type).join(',') || '无'}`
        } else {
          ok = true
          if (c.nameIncludes && !(a.name ?? '').includes(c.nameIncludes)) { ok = false; detail = `name「${a.name}」不含「${c.nameIncludes}」` }
          if (ok && c.protein && !inRange(a.protein, c.protein)) { ok = false; detail = `蛋白 ${a.protein} 不在 [${c.protein}]` }
          if (ok && c.durationMin && !inRange(a.durationMin, c.durationMin)) { ok = false; detail = `时长 ${a.durationMin} 不在 [${c.durationMin}]` }
          if (ok) detail = 'ok'
        }
      }
      rows.push({ name: `「${c.text}」`, status: ok ? 'pass' : 'fail', detail })
    } catch (e) {
      rows.push({ name: `「${c.text}」`, status: isRateLimit(e) ? 'skip' : 'fail', detail: `${e instanceof Error ? e.message : e}` })
    }
    await sleep(CALL_GAP_MS)
  }
  return printSuite('3 · 助手工具调用', rows)
}

// ── 主流程 ────────────────────────────────────────────────
const only = process.argv.slice(2).map((s) => s.toLowerCase())
const wants = (name: string) => only.length === 0 || only.includes(name)

const rates: { suite: string; rate: number | null }[] = []
if (wants('lookup')) rates.push({ suite: 'lookup', rate: await runLookup() })
if (wants('assistant')) rates.push({ suite: 'assistant', rate: await runAssistant() })

console.log('\n────────────────────────────')
let failed = false
for (const r of rates) {
  if (r.rate === null) {
    console.log(`⚠️  ${r.suite}: 全被限流跳过，本次不确定（不判失败）`)
    continue
  }
  const ok = r.rate >= PASS_THRESHOLD
  if (!ok) failed = true
  console.log(`${ok ? '✅' : '❌'} ${r.suite}: ${(r.rate * 100).toFixed(0)}%（阈值 ${PASS_THRESHOLD * 100}%）`)
}
if (rates.length === 0) console.log('没有匹配的套件，可用：lookup / assistant')
process.exitCode = failed ? 1 : 0
