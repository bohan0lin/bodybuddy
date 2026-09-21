export function auditCatalog(rows: Record<string, unknown>[]): {
  version: string
  rows: number
  sha256: string
  status: 'review-required' | 'structural-checks-pass'
  issueCounts: Record<string, number>
  entries: { index: number; name: unknown; nameEn: unknown; unit: unknown; issues: string[] }[]
}
