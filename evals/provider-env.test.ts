import { expect, it } from 'vitest'
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProviderKeys } from './provider-env.mjs'

it('imports provider keys without importing production database credentials', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bodybuddy-env-'))
  try {
    const file = join(dir, 'env')
    writeFileSync(file, 'GOOGLE_GENERATIVE_AI_API_KEY=test-google\nOPENAI_API_KEY=test-openai\nSUPABASE_SERVICE_ROLE_KEY=private\nVITE_SUPABASE_URL=https://production.invalid\n')
    const env = { OPENAI_API_KEY: 'existing' }
    loadProviderKeys(file, env)
    expect(env).toEqual({ OPENAI_API_KEY: 'existing', GOOGLE_GENERATIVE_AI_API_KEY: 'test-google' })
  } finally { rmSync(join(dir, 'env')); rmdirSync(dir) }
})
