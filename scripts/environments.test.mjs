import { expect, it } from 'vitest'
import { assertSeedTarget, deployEnvironmentProblems, projectRef } from './environments.mjs'

const staging = 'abcdefghijklmnopqrst'
const production = 'zyxwvutsrqponmlkjihg'
const url = (ref) => `https://${ref}.supabase.co`

it('recognises hosted project refs and the local stack only', () => {
  expect(projectRef(url(staging))).toBe(staging)
  expect(projectRef(`${url(staging)}/`)).toBe(staging)
  expect(projectRef('http://127.0.0.1:54321/')).toBe('local')
  expect(projectRef(`http://${staging}.supabase.co`)).toBeNull()
  expect(projectRef('https://db.example.com')).toBeNull()
  expect(projectRef(`${url(staging)}/rest/v1`)).toBeNull()
  expect(projectRef(undefined)).toBeNull()
})

it('seeds only an explicitly confirmed non-production project', () => {
  const target = { url: url(staging), expectedRef: staging, productionRef: production, confirmedRef: staging }
  expect(assertSeedTarget(target)).toBe(staging)
  expect(() => assertSeedTarget({ ...target, url: url(production), expectedRef: production, confirmedRef: production })).toThrow('production')
  expect(() => assertSeedTarget({ ...target, expectedRef: production })).toThrow('does not match')
  expect(() => assertSeedTarget({ ...target, productionRef: undefined })).toThrow('PRODUCTION_SUPABASE_PROJECT_REF')
  expect(() => assertSeedTarget({ ...target, confirmedRef: undefined })).toThrow(`--confirm ${staging}`)
  expect(assertSeedTarget({ url: 'http://127.0.0.1:54321', expectedRef: 'local', confirmedRef: 'local' })).toBe('local')
})

it('fails preview builds that are not isolated staging deployments', () => {
  const preview = { VERCEL_ENV: 'preview', VITE_APP_ENV: 'staging', PRODUCTION_SUPABASE_PROJECT_REF: production, VITE_SUPABASE_URL: url(staging) }
  expect(deployEnvironmentProblems(preview)).toEqual([])
  expect(deployEnvironmentProblems({ ...preview, SUPABASE_URL: url(production) })).toEqual(['Preview builds must not use the production Supabase project'])
  expect(deployEnvironmentProblems({ ...preview, VITE_SUPABASE_URL: url(production) })).toHaveLength(1)
  expect(deployEnvironmentProblems({ ...preview, VITE_APP_ENV: undefined, PRODUCTION_SUPABASE_PROJECT_REF: undefined })).toHaveLength(2)
  expect(deployEnvironmentProblems({ ...preview, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toHaveLength(2)
})

it('keeps production builds on production and leaves local builds unchecked', () => {
  const live = { VERCEL_ENV: 'production', PRODUCTION_SUPABASE_PROJECT_REF: production, VITE_SUPABASE_URL: url(production) }
  expect(deployEnvironmentProblems(live)).toEqual([])
  expect(deployEnvironmentProblems({ ...live, VITE_APP_ENV: 'staging' })).toHaveLength(1)
  expect(deployEnvironmentProblems({ ...live, SUPABASE_URL: url(staging) })).toHaveLength(1)
  expect(deployEnvironmentProblems({ VITE_SUPABASE_URL: url(production), VITE_APP_ENV: 'staging' })).toEqual([])
  expect(deployEnvironmentProblems({ VERCEL_ENV: 'development' })).toEqual([])
})
