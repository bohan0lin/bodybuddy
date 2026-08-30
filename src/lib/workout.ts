// 运动类型与消耗估算（MET 法，纯本地计算，无需联网）
//   消耗 kcal = MET × 体重(kg) × 时长(小时)
// MET 参考运动生理学常用值；i18n 标签见 workout.type.<key>

export interface ActivityType {
  key: string
  met: number
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { key: 'strength', met: 5 }, // 力量训练
  { key: 'run', met: 9.8 }, // 跑步
  { key: 'hiit', met: 8 }, // 高强度间歇
  { key: 'cycling', met: 7 }, // 骑行
  { key: 'ball', met: 7 }, // 球类
  { key: 'swim', met: 8 }, // 游泳
  { key: 'walk', met: 3.8 }, // 快走
  { key: 'yoga', met: 3 }, // 瑜伽/拉伸
  { key: 'other', met: 4 }, // 其他
]

export function metOf(typeKey: string): number {
  return ACTIVITY_TYPES.find((a) => a.key === typeKey)?.met ?? 4
}

// 体重缺失时用 70kg 兜底
export function estimateBurn(typeKey: string, weightKg: number, minutes: number): number {
  const w = weightKg > 0 ? weightKg : 70
  return Math.round(metOf(typeKey) * w * (Math.max(0, minutes) / 60))
}
