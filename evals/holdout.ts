import type { RetrievalCase } from './dataset'

// Frozen acceptance queries, authored 2026-09-15 before any tuning against them.
// Never adjust retrieval code to these cases. Editing them requires a new HOLDOUT_VERSION and holdout.lock.json,
// and results from different versions must not be compared.
export const HOLDOUT_VERSION = 'retrieval-holdout-v1'

export const retrievalHoldout: RetrievalCase[] = [
  { id: 'h01', category: 'exact-alias', query: '西红柿', expected: '番茄' },
  { id: 'h02', category: 'exact-alias', query: '地瓜', expected: '红薯' },
  { id: 'h03', category: 'exact-alias', query: '米线', expected: '米粉' },
  { id: 'h04', category: 'cross-language', query: 'Broccoli', expected: '西兰花' },
  { id: 'h05', category: 'cross-language', query: 'Oats', expected: '燕麦' },
  { id: 'h06', category: 'cross-language', query: 'avocado', expected: '牛油果' },
  { id: 'h07', category: 'semantic', query: '白煮蛋', expected: '鸡蛋' },
  { id: 'h08', category: 'semantic', query: 'soymilk', expected: '豆浆' },
  { id: 'h09', category: 'unit-compatible', query: '豆浆', unit: 'l', expected: '豆浆' },
  { id: 'h10', category: 'unit-compatible', query: '香蕉', unit: 'kg', expected: '香蕉' },
  { id: 'h11', category: 'unit-compatible', query: 'olive oil', unit: 'ml', expected: '橄榄油' },
  { id: 'h12', category: 'unit-mismatch', query: '可乐', unit: 'g', expected: null },
  { id: 'h13', category: 'unit-mismatch', query: 'Peanut butter', unit: 'ml', expected: null },
  { id: 'h14', category: 'unit-mismatch', query: '米饭', unit: 'cup', expected: null },
  { id: 'h15', category: 'metadata-filter', query: '花生', brand: 'Holdout Brand B', expected: null },
  { id: 'h16', category: 'metadata-filter', query: '三文鱼', preparation: 'smoked', expected: null },
  // Several catalog foods fit these equally well; the expected product behaviour is to abstain.
  { id: 'h17', category: 'ambiguous', query: '面包', expected: null },
  { id: 'h18', category: 'ambiguous', query: 'beans', expected: null },
  { id: 'h19', category: 'no-match', query: 'dish soap', expected: null },
  { id: 'h20', category: 'no-match', query: '钢笔', expected: null },
]
