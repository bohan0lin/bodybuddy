import { createClient } from '@supabase/supabase-js'
import { assertSeedTarget } from '../environments.mjs'
import { SEED_MARKER, buildStagingAccounts, localDate } from './data.mjs'

// Seeds synthetic acceptance accounts. It reads only STAGING_* variables, never the application's production names.
// Usage: npm run staging:seed -- --confirm <project-ref> [--today YYYY-MM-DD]
const option = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined }

try {
  const url = process.env.STAGING_SUPABASE_URL
  const ref = assertSeedTarget({ url, expectedRef: process.env.STAGING_SUPABASE_PROJECT_REF, productionRef: process.env.PRODUCTION_SUPABASE_PROJECT_REF, confirmedRef: option('--confirm') })
  const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
  const password = process.env.STAGING_TEST_PASSWORD
  if (!serviceKey) throw new Error('STAGING_SUPABASE_SERVICE_ROLE_KEY is required')
  if (!password || password.length < 12) throw new Error('STAGING_TEST_PASSWORD must contain at least 12 characters')
  const today = option('--today') ?? localDate()
  const accounts = buildStagingAccounts(today)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const emails = new Set(accounts.map((account) => account.email))
  const existing = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('Could not list staging users')
    existing.push(...data.users.filter((user) => emails.has(user.email)))
    if (data.users.length < 200) break
  }
  // Only accounts this script created are replaced; anything else with a reserved email stops the run.
  const foreign = existing.filter((user) => user.user_metadata?.seed !== SEED_MARKER)
  if (foreign.length) throw new Error(`Refusing to replace accounts not created by this script: ${foreign.map((user) => user.email).join(', ')}`)
  for (const user of existing) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`Could not remove previous seed account ${user.email}`)
  }

  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true, user_metadata: { seed: SEED_MARKER, account: account.label } })
    if (error || !data.user) throw new Error(`Could not create ${account.email}`)
    const userId = data.user.id
    if (account.profile) {
      const { error: profileError } = await admin.from('profiles').upsert({ id: userId, ...account.profile })
      if (profileError) throw new Error(`Could not write the profile for ${account.email}`)
    }
    const counts = []
    for (const table of ['weight_logs', 'meals', 'workouts', 'saved_items', 'knowledge']) {
      if (!account[table].length) continue
      const { error: insertError } = await admin.from(table).insert(account[table].map((row) => ({ ...row, user_id: userId })))
      if (insertError) throw new Error(`Could not write ${table} for ${account.email}`)
      counts.push(`${table} ${account[table].length}`)
    }
    console.log(`${account.email} (${account.label}): ${counts.join(', ') || 'no records'}`)
  }
  console.log(`Seeded ${accounts.length} synthetic accounts into ${ref} for ${today}. Sign in with STAGING_TEST_PASSWORD.`)
} catch (error) {
  // Messages are written by this script; provider errors and keys are never printed.
  console.error(error instanceof Error ? error.message : 'Staging seed failed')
  process.exit(1)
}
