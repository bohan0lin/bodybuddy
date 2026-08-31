import { generateObject } from 'ai'
import { z } from 'zod'
import { MODEL } from './ai.js'

const schema = z.object({
  relevant: z.boolean().describe('这段话是否包含健身/营养/训练相关的知识'),
  title: z.string().describe('简短主题，10 字左右'),
  content: z.string().describe('整理后的知识正文，简洁清晰、成句'),
  tags: z.string().describe('逗号分隔的标签，便于日后归类'),
})

// 把用户口述/粗糙的一段话，整理成一条干净的健身/营养知识
export async function tidyKnowledge(
  text: string,
  lang?: 'zh' | 'en',
): Promise<{ relevant: boolean; title: string; content: string; tags: string }> {
  const isEn = lang === 'en'
  const system = isEn
    ? 'Turn the user\'s spoken/rough note into ONE clean fitness/nutrition knowledge entry. Keep only fitness/diet/training substance, fix grammar, be concise and factual. If there is no fitness/nutrition knowledge, set relevant=false and leave the rest brief.'
    : '把用户口述/粗糙的一段话，整理成一条干净的健身/营养知识条目。只保留健身/饮食/训练相关的干货，修正语病，简洁、成句、准确。若这段话里没有健身营养知识，relevant 设为 false，其余留简短即可。'

  const { object } = await generateObject({ model: MODEL, schema, system, prompt: text || ' ', maxRetries: 3 })
  return object
}
