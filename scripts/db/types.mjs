import { readFile, writeFile } from 'node:fs/promises'
import { localDatabase, supabase } from './local.mjs'

const db = await localDatabase()
await db.end()
const path = 'src/lib/database.types.ts'
const generated = supabase(['gen', 'types', 'typescript', '--local', '--schema', 'public']).replaceAll('\r\n', '\n').trimEnd() + '\n'
if (!generated.includes('export type Database =')) throw new Error('Supabase did not return database types.')
if (process.argv.includes('--check')) {
  const current = await readFile(path, 'utf8').catch(() => '')
  if (current.replaceAll('\r\n', '\n') !== generated) throw new Error('Database types are missing or stale. Run npm run db:types against the migrated local database and commit the result.')
  console.log('Generated database types match the migrated schema.')
} else {
  await writeFile(path, generated)
  console.log('Generated src/lib/database.types.ts from the local Supabase schema.')
}
