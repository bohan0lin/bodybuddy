// ── 金标数据集（手写，随时增补）──────────────────────────────
// 只覆盖：2 名字查营养(向量RAG) + 3 助手工具调用

// 2) 食物名 → 期望命中的规范名；expectNoMatch=true 表示应「查不到」（不误命中）
export interface LookupCase {
  query: string
  expect?: string
  expectNoMatch?: boolean
}

export const lookupCases: LookupCase[] = [
  { query: '鸡胸肉', expect: '鸡胸肉' },
  { query: 'chicken breast', expect: '鸡胸肉' },
  { query: '鸡胸', expect: '鸡胸肉' },
  { query: '三文鱼', expect: '三文鱼' },
  { query: '鲑鱼', expect: '三文鱼' },
  { query: 'salmon', expect: '三文鱼' },
  { query: '牛奶', expect: '牛奶' },
  { query: 'greek yogurt', expect: '希腊酸奶' },
  { query: '鸡蛋', expect: '鸡蛋' },
  { query: '豆腐', expect: '豆腐' },
  { query: 'asdfqwer 一个根本不存在的东西', expectNoMatch: true },
]

// 3) 用户说的话 → 期望助手提出的动作（工具调用）
//    action=null 表示「不该调用任何工具」（只答话）
export interface AssistantCase {
  text: string
  action: 'log' | 'save' | 'workout' | null
  nameIncludes?: string
  protein?: [number, number]
  durationMin?: [number, number]
}

export const assistantCases: AssistantCase[] = [
  { text: '我吃了100克鸡胸肉，帮我记一下', action: 'log', nameIncludes: '鸡', protein: [22, 40] },
  { text: '帮我把牛奶加到常用', action: 'save' },
  { text: '我今天练了胸，一个小时', action: 'workout', durationMin: [45, 75] },
  { text: '今天跑步 30 分钟', action: 'workout', durationMin: [20, 40] },
  { text: '我今天还该吃多少蛋白？', action: null },
]

// 助手评测用的固定上下文（简化的一份用户数据）
export const assistantContext = {
  targets: { protein: 150, carbs: 200, fat: 60, calories: 1900 },
  consumed: { protein: 0, carbs: 0, fat: 0, calories: 0 },
  todayMeals: [] as { name: string; type: string }[],
  savedItems: [
    { kind: 'food', name: '牛奶', unit: 'ml', baseAmount: 100, protein: 3.4, carbs: 4.8, fat: 3.3, calories: 61 },
  ],
  hour: 12,
}
