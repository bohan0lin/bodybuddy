import { generateText, generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { lookupFoods } from './rag.js'

// ══════════════════════════════════════════════════════════════
// 切换 AI 只需改下面这一行 MODEL（对应的 key 放到 .env.local / Vercel 环境变量）：
//   google('gemini-3.6-flash')    有免费额度、支持视觉（默认） → 需要 GOOGLE_GENERATIVE_AI_API_KEY
//   openai('gpt-4o-mini')         便宜、支持视觉                → 需要 OPENAI_API_KEY
//   anthropic('claude-sonnet-5')  Claude 性价比高              → 需要 ANTHROPIC_API_KEY
// ══════════════════════════════════════════════════════════════
export const MODEL = google('gemini-3.6-flash')

// 引用一下未使用的 provider，避免 lint 报未使用（切换时随时会用到）
void openai
void anthropic

type Macros = { protein: number; carbs: number; fat: number; calories: number }

export interface SavedItemLite {
  kind: 'food' | 'meal'
  name: string
  unit: string
  baseAmount: number
  protein: number
  carbs: number
  fat: number
  calories: number
}

export interface SuggestInput {
  targets: Macros
  consumed: Macros
  meals: { name: string; type: string }[]
  hour: number
  mode?: 'general' | 'library' // general=通用建议；library=从用户常用库里挑
  savedItems?: SavedItemLite[]
  lang?: 'zh' | 'en'
}

// ── 饮食建议 ────────────────────────────────────────────────
export async function suggestMeal(input: SuggestInput): Promise<{ text: string }> {
  const rem: Macros = {
    protein: Math.max(0, Math.round(input.targets.protein - input.consumed.protein)),
    carbs: Math.max(0, Math.round(input.targets.carbs - input.consumed.carbs)),
    fat: Math.max(0, Math.round(input.targets.fat - input.consumed.fat)),
    calories: Math.max(0, Math.round(input.targets.calories - input.consumed.calories)),
  }

  const fromLibrary = input.mode === 'library'
  const isEn = input.lang === 'en'

  const langRule = isEn
    ? '- Reply in English, professional, concise, and encouraging.'
    : '- 用简体中文，语气专业、简洁、鼓励。'

  const commonRules = `${langRule}
- 开头一句点明剩余额度（热量与蛋白最重要）。
- 结合当前时间（越晚越清淡、避免高碳水）。
- 总长度 140 字以内，用简短分行；不要使用 markdown 标题或星号，用「·」作为项目符号。`

  let system: string
  let libraryBlock = ''

  if (fromLibrary) {
    const list = (input.savedItems ?? [])
      .map(
        (s) =>
          `【${s.kind === 'meal' ? '套餐' : '食物'}】${s.name}（每 ${s.baseAmount}${s.unit}：热量${s.calories} 蛋白${s.protein}g 碳水${s.carbs}g 脂肪${s.fat}g）`,
      )
      .join('\n')
    libraryBlock = `\n用户的常用清单：\n${list || '（空）'}`
    system = `你是 BodyBuddy 的私人营养教练。请**只从用户下面的常用食物/套餐清单里**挑选并搭配，为用户**生成今天剩余额度的一套饮食方案**：把剩下的额度（尤其蛋白）尽量补齐，且不超剩余热量。
${commonRules}
- 只用清单里有的项；可调整分量（如「鸡胸肉 150g」），可组合多项、可按餐次（如晚餐/加餐）组织。
- 每条写清「食物名 + 建议分量」；结尾用一行给出这套方案的合计（约 X 千卡、蛋白 Xg）。
- 若清单为空或凑不齐，就直说清单里不够，并建议去「记一餐」保存常用食物。`
  } else {
    system = `你是 BodyBuddy 的私人营养教练。根据用户今天的目标、已摄入量和已吃的食物，给出"接下来还能吃什么"的通用建议。
${commonRules}
- 给出 2-3 个具体食物或搭配建议，优先补齐蛋白缺口，并控制在剩余热量内。`
  }

  const prompt = `目标：热量 ${input.targets.calories}、蛋白 ${input.targets.protein}g、碳水 ${input.targets.carbs}g、脂肪 ${input.targets.fat}g
已摄入：热量 ${Math.round(input.consumed.calories)}、蛋白 ${Math.round(input.consumed.protein)}g、碳水 ${Math.round(input.consumed.carbs)}g、脂肪 ${Math.round(input.consumed.fat)}g
剩余：热量 ${rem.calories}、蛋白 ${rem.protein}g、碳水 ${rem.carbs}g、脂肪 ${rem.fat}g
今天已吃：${input.meals.map((m) => m.name).join('、') || '还没吃'}
当前时间：${input.hour} 点${libraryBlock}`

  const { text } = await generateText({ model: MODEL, system, prompt, maxRetries: 3 })
  return { text: text.trim() }
}

// ── 拍照识别 ────────────────────────────────────────────────
export interface RecognizedItem {
  name: string
  amount: number
  unit: string
  protein: number
  carbs: number
  fat: number
  calories: number
}

const recogSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('简体中文食物名'),
      amount: z.number().describe('可见分量数值'),
      unit: z.string().describe('单位：能称重的用 g，否则用「份」'),
      protein: z.number().describe('该分量的蛋白质克数'),
      carbs: z.number().describe('该分量的碳水克数'),
      fat: z.number().describe('该分量的脂肪克数'),
      calories: z.number().describe('该分量的热量千卡'),
    }),
  ),
})

export async function recognizeFood(
  imageBase64: string,
  mediaType: string,
  lang?: 'zh' | 'en',
): Promise<{ items: RecognizedItem[] }> {
  const dataUrl = `data:${mediaType || 'image/jpeg'};base64,${imageBase64}`
  const nameRule =
    lang === 'en'
      ? '- name in English, concise.'
      : '- name 用简体中文简洁命名。'

  const system = `你是营养识别助手。识别图片中的主要食物，估算每种食物的分量与营养。
${nameRule}
- 最多 5 项，按主次排序。
- amount/unit 估算可见分量（能称重的食物用 g，否则用「份」；英文界面可用 "serving"）。
- 各营养值为「该分量」下的估算值。
- 若图中没有可识别的食物，items 返回空数组。`

  const { object } = await generateObject({
    model: MODEL,
    schema: recogSchema,
    system,
    maxRetries: 3,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '识别这张图里的食物并估算营养。' },
          { type: 'image', image: dataUrl },
        ],
      },
    ],
  })

  // RAG 校准：命中营养库且为重量单位时，用库里的精准值按分量换算覆盖模型估算
  let items = object.items
  try {
    const matches = await lookupFoods(items.map((it) => it.name))
    const r1 = (n: number) => Math.round(n * 10) / 10
    items = items.map((it, i) => {
      const m = matches[i]
      if (m && m.matched && (it.unit === 'g' || it.unit === 'ml') && it.amount > 0) {
        const k = it.amount / m.baseAmount
        return {
          ...it,
          protein: r1(m.protein * k),
          carbs: r1(m.carbs * k),
          fat: r1(m.fat * k),
          calories: Math.round(m.calories * k),
        }
      }
      return it
    })
  } catch (e) {
    console.error('rag grounding failed', e)
  }

  return { items }
}
