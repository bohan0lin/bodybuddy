import { randomUUID } from 'node:crypto'
import { authenticate } from './auth.js'
import { loadContext } from './context.js'
import { requests, responses, MAX_BODY_BYTES, type Endpoint } from './contracts.js'
import { ApiError, sendError, type ApiRequest, type ApiResponse } from './http.js'
import { validateImage } from './image.js'

export function createEndpoint(endpoint: Endpoint) {
  return async (req: ApiRequest, res: ApiResponse) => {
    const requestId = randomUUID()
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Request-Id', requestId)
    try {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.')
      }
      const identity = await authenticate(req.headers)
      const contentType = req.headers['content-type']
      if (typeof contentType !== 'string' || contentType.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.')
      let body = req.body
      const encoded = typeof body === 'string' ? body : JSON.stringify(body)
      if (!encoded || Buffer.byteLength(encoded) > MAX_BODY_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large or empty.')
      if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch { throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON request.') }
      }
      const parsed = requests[endpoint].safeParse(body)
      if (!parsed.success) throw new ApiError(400, 'INVALID_REQUEST', 'Request fields are invalid.')
      let result: unknown
      // Narrow each contract separately; model modules load only after authentication/validation.
      if (endpoint === 'assistant') {
        const input = requests.assistant.parse(parsed.data)
        for (const message of input.messages) {
          if (message.image) {
            const [prefix, image] = message.image.split(',')
            await validateImage(image, prefix.slice(5, -7))
          }
        }
        const context = await loadContext(identity, input.date, input.hour)
        const { assistantChat } = await import('./assistant.js')
        result = await assistantChat({ messages: input.messages, context, lang: input.lang })
      } else if (endpoint === 'suggest') {
        const input = requests.suggest.parse(parsed.data)
        const context = await loadContext(identity, input.date, input.hour)
        const { suggestMeal } = await import('./ai.js')
        result = await suggestMeal({ targets: context.targets, consumed: context.consumed, meals: context.todayMeals, savedItems: context.savedItems.map((s) => ({ ...s, kind: s.kind as 'food' | 'meal' })), hour: input.hour, mode: input.mode, lang: input.lang })
      } else if (endpoint === 'recognize') {
        const input = requests.recognize.parse(parsed.data)
        await validateImage(input.image, input.mediaType)
        const { recognizeFood } = await import('./ai.js')
        result = await recognizeFood(input.image, input.mediaType, input.lang)
      } else if (endpoint === 'lookup') {
        const input = requests.lookup.parse(parsed.data)
        const { lookupFoods } = await import('./rag.js')
        const [match] = await lookupFoods([input.name])
        result = { match }
      } else {
        const input = requests.knowledge.parse(parsed.data)
        const { tidyKnowledge } = await import('./knowledge.js')
        result = await tidyKnowledge(input.text, input.lang)
      }
      const output = responses[endpoint].safeParse(result)
      if (!output.success) throw new ApiError(502, 'INVALID_MODEL_RESPONSE', 'AI returned an invalid result. Please retry.')
      res.status(200).json(output.data)
    } catch (error) {
      // Never log auth headers, SDK errors, prompts, photos or health data.
      sendError(res, error, requestId)
    }
  }
}
