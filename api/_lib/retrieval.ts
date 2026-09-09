export const RETRIEVAL_VERSION = 'exact-metadata-units-v1'
export const DISTANCE_THRESHOLD = 0.45
export const AMBIGUITY_MARGIN = 0.04

const units: Record<string, { dimension: 'mass' | 'volume'; factor: number; base: 'g' | 'ml' }> = {
  g: { dimension: 'mass', factor: 1, base: 'g' }, kg: { dimension: 'mass', factor: 1000, base: 'g' },
  mg: { dimension: 'mass', factor: 0.001, base: 'g' }, oz: { dimension: 'mass', factor: 28.349523125, base: 'g' },
  lb: { dimension: 'mass', factor: 453.59237, base: 'g' }, ml: { dimension: 'volume', factor: 1, base: 'ml' },
  l: { dimension: 'volume', factor: 1000, base: 'ml' },
}
const aliases: Record<string, string> = { '克': 'g', '千克': 'kg', '公斤': 'kg', '毫升': 'ml', '升': 'l', grams: 'g', gram: 'g', liters: 'l', litre: 'l' }
function parseUnit(unit: string) { const key = unit.trim().toLowerCase(); return units[aliases[key] ?? key] }
export function referenceUnit(unit?: string) { return unit ? parseUnit(unit)?.base : undefined }
export function nutritionRatio(amount: number, unit: string, baseAmount: number, baseUnit: string): number | null {
  const from = parseUnit(unit), to = parseUnit(baseUnit)
  if (!from || !to || from.dimension !== to.dimension || !Number.isFinite(amount) || !Number.isFinite(baseAmount) || amount <= 0 || baseAmount <= 0) return null
  return amount * from.factor / (baseAmount * to.factor)
}
export function selectCandidate<T extends { distance: number }>(candidates: T[], exact = false): T | null {
  if (!candidates.length) return null
  if (exact) return candidates.length === 1 ? candidates[0] : null
  const sorted = [...candidates].sort((a,b) => a.distance - b.distance)
  const best = sorted[0]
  if (!Number.isFinite(best.distance) || best.distance < 0 || best.distance > DISTANCE_THRESHOLD) return null
  if (sorted[1] && sorted[1].distance - best.distance < AMBIGUITY_MARGIN) return null
  return best
}
