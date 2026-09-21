import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Import provider keys only; never import application database credentials.
export function loadProviderKeys(path, env = process.env) {
  const values = parseEnv(readFileSync(path, 'utf8'))
  for (const name of ['GOOGLE_GENERATIVE_AI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
    if (!env[name] && values[name]) env[name] = values[name]
  }
}
