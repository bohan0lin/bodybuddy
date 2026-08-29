import { generateText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { MODEL } from './ai.js'

type Macros = { protein: number; carbs: number; fat: number; calories: number }

export interface AssistantContext {
  targets: Macros
  consumed: Macros
  todayMeals: { name: string; type: string }[]
  recentDays?: { date: string; calories: number; protein: number; carbs: number; fat: number }[]
  savedItems: { kind: string; name: string; brand?: string; unit: string; baseAmount: number; protein: number; carbs: number; fat: number; calories: number }[]
  latestWeight?: { weight: number; bodyFat?: number }
  hour: number
}

export interface ClientMessage {
  role: 'user' | 'assistant'
  text: string
  image?: string // data URL
}

export interface AssistantAction {
  type: 'log' | 'save'
  // log
  mealType?: string
  // save
  kind?: 'food' | 'meal'
  name?: string
  brand?: string
  amount?: number
  unit?: string
  baseAmount?: number
  protein?: number
  carbs?: number
  fat?: number
  calories?: number
}

function buildSystem(ctx: AssistantContext, isEn: boolean): string {
  const rem = {
    calories: Math.max(0, Math.round(ctx.targets.calories - ctx.consumed.calories)),
    protein: Math.max(0, Math.round(ctx.targets.protein - ctx.consumed.protein)),
    carbs: Math.max(0, Math.round(ctx.targets.carbs - ctx.consumed.carbs)),
    fat: Math.max(0, Math.round(ctx.targets.fat - ctx.consumed.fat)),
  }
  const saved = ctx.savedItems
    .slice(0, 40)
    .map((s) => `- [${s.kind === 'meal' ? '套餐' : '食物'}] ${s.name}${s.brand ? `(${s.brand})` : ''} 每${s.baseAmount}${s.unit}: 热${s.calories} 蛋${s.protein} 碳${s.carbs} 脂${s.fat}`)
    .join('\n')

  const langRule = isEn
    ? 'Reply in English, warm, concise, like a personal coach.'
    : '用简体中文回复，语气亲切、简洁，像私人教练。'

  return `你是 BodyBuddy 的私人健身饮食助手。基于下面这位用户的真实数据回答问题、帮他记录饮食。
${langRule}

【用户数据】
每日目标：热量 ${ctx.targets.calories}、蛋白 ${ctx.targets.protein}g、碳水 ${ctx.targets.carbs}g、脂肪 ${ctx.targets.fat}g
今天已摄入：热量 ${Math.round(ctx.consumed.calories)}、蛋白 ${Math.round(ctx.consumed.protein)}g、碳水 ${Math.round(ctx.consumed.carbs)}g、脂肪 ${Math.round(ctx.consumed.fat)}g
今天还剩：热量 ${rem.calories}、蛋白 ${rem.protein}g、碳水 ${rem.carbs}g、脂肪 ${rem.fat}g
今天已吃：${ctx.todayMeals.map((m) => m.name).join('、') || '还没吃'}
近 7 天摄入（日期: 热量/蛋白/碳水/脂肪）：
${(ctx.recentDays ?? []).map((d) => `${d.date}: ${d.calories}千卡 蛋${d.protein} 碳${d.carbs} 脂${d.fat}`).join('\n') || '无'}
最新体重：${ctx.latestWeight ? `${ctx.latestWeight.weight}kg${ctx.latestWeight.bodyFat != null ? ` 体脂${ctx.latestWeight.bodyFat}%` : ''}` : '未记录'}
当前时间：${ctx.hour} 点
常用清单：
${saved || '（空）'}

【规则】
- 用户问目标/营养/建议时，直接用上面的数据回答，简短。
- 用户问"最近吃得怎么样/这几天/趋势"，用近 7 天摄入数据分析（是否达标、蛋白够不够、波动等），给简短点评+1 个改进建议。
- 用户说"我吃了…帮我记录"或发来食物照片说吃了多少，就调用 logMeal 工具提出记账（估算营养、按分量换算；能称重的用 g）。可以参考常用清单里的数据。
- 用户说"加到常用/收藏"，调用 saveFavorite 工具提出保存。
- 调用工具后，用一句话告诉用户"已为你准备好，请确认"。不要假装已经保存——真正保存需要用户点确认。
- 营养数值用千卡；不确定就合理估算并说明是估算。`
}

export async function assistantChat(input: {
  messages: ClientMessage[]
  context: AssistantContext
  lang?: 'zh' | 'en'
}): Promise<{ reply: string; actions: AssistantAction[] }> {
  const actions: AssistantAction[] = []

  const tools = {
    logMeal: tool({
      description: '记录一餐（提议，需用户确认后才保存）',
      inputSchema: z.object({
        name: z.string(),
        brand: z.string().optional(),
        amount: z.number().optional(),
        unit: z.string().optional(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        calories: z.number(),
      }),
      execute: async (a) => {
        actions.push({ type: 'log', ...a })
        return { queued: true }
      },
    }),
    saveFavorite: tool({
      description: '把食物或套餐加入常用（提议，需用户确认）',
      inputSchema: z.object({
        kind: z.enum(['food', 'meal']),
        name: z.string(),
        brand: z.string().optional(),
        unit: z.string(),
        baseAmount: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        calories: z.number(),
      }),
      execute: async (a) => {
        actions.push({ type: 'save', ...a })
        return { queued: true }
      },
    }),
  }

  const system = buildSystem(input.context, input.lang === 'en')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const messages: any[] = input.messages.map((m) => {
    if (m.image && m.role === 'user') {
      return { role: 'user', content: [{ type: 'text', text: m.text || '（这张图）' }, { type: 'image', image: m.image }] }
    }
    return { role: m.role, content: m.text }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { text } = await generateText({ model: MODEL, system, messages, tools, stopWhen: stepCountIs(4), maxRetries: 4 })
  return { reply: text.trim(), actions }
}
