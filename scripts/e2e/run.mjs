import { spawn } from 'node:child_process'
import { localDatabase, supabase } from '../db/local.mjs'

// Fail closed before obtaining local keys; no remote URL or production-secret fallback.
const db = await localDatabase()
await db.end()
const status = JSON.parse(supabase(['status', '-o', 'json']))
if (status.API_URL !== 'http://127.0.0.1:54321') throw new Error('E2E requires the disposable local Supabase API')
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local authentication keys unavailable')
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/e2e/playwright.config.ts', ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, E2E_LOCAL_ONLY: '1', E2E_SUPABASE_URL: status.API_URL, E2E_ANON_KEY: status.ANON_KEY, E2E_SERVICE_KEY: status.SERVICE_ROLE_KEY },
})
child.on('exit', code => { process.exitCode = code ?? 1 })
