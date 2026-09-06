import pg from 'pg'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// Intentionally no DATABASE_URL, linked-project or production-credential support.
// The test stack is identified by its fixed project name, port and container label.
export async function localDatabase() {
  const inspection = spawnSync('docker', ['ps', '--filter', 'name=supabase_db_bodybuddy-local', '--format', '{{.Names}}'], { encoding: 'utf8', windowsHide: true })
  if (inspection.status !== 0 || !inspection.stdout.split(/\r?\n/).some((name) => name.trim() === 'supabase_db_bodybuddy-local')) throw new Error('Start the disposable bodybuddy-local Supabase stack before running database tools.')
  const client = new pg.Client({ host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres', connectionTimeoutMillis: 10000, statement_timeout: 15000 })
  await client.connect()
  return client
}

export function supabase(args, options = {}) {
  const result = spawnSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'), ...args], { encoding: 'utf8', windowsHide: true, ...options })
  if (result.status !== 0) throw new Error(`Local Supabase command failed: ${args.join(' ')}\n${result.stderr ?? ''}`)
  return result.stdout
}
