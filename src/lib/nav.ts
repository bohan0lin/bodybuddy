import type { IconName } from '../components/AppIcon'

export type TabKey = 'today' | 'calendar' | 'coach' | 'me'

// 四格导航；子路由按路由族归属所属分区
export const NAV_TABS: { key: TabKey; to: string; icon: IconName; match: (p: string) => boolean }[] = [
  { key: 'today', to: '/', icon: 'home', match: (p) => p === '/' },
  { key: 'calendar', to: '/calendar', icon: 'calendar', match: (p) => p === '/calendar' || p.startsWith('/day') || p === '/history' },
  { key: 'coach', to: '/coach', icon: 'sparkles', match: (p) => p === '/coach' || p === '/knowledge' },
  { key: 'me', to: '/settings', icon: 'user', match: (p) => p === '/settings' || p.startsWith('/settings/') || p === '/body' },
]

// 当前路径对应的高亮分区；/log 与 /workout 不属于任何分区（返回 null）
export function activeTabKey(pathname: string): TabKey | null {
  return NAV_TABS.find((t) => t.match(pathname))?.key ?? null
}
