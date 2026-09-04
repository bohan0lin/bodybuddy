import type { CSSProperties, ReactNode } from 'react'

// 统一的细线图标（stroke 1.8），避免引入图标依赖；风格与全 App 一致
export type IconName =
  | 'home'
  | 'calendar'
  | 'sparkles'
  | 'user'
  | 'mic'
  | 'camera'
  | 'pencil'
  | 'chevron-right'
  | 'chevron-left'
  | 'dumbbell'
  | 'settings'
  | 'x'
  | 'sunrise'
  | 'utensils'
  | 'cookie'
  | 'book'

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <line x1="3.5" y1="9" x2="20.5" y2="9" />
      <line x1="8" y1="2.7" x2="8" y2="6.3" />
      <line x1="16" y1="2.7" x2="16" y2="6.3" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.4l1.7 4.6 4.6 1.7-4.6 1.7L12 16l-1.7-4.6L5.7 9.7l4.6-1.7z" />
      <path d="M18 14.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  pencil: (
    <>
      <path d="M5 16 16 5a2 2 0 0 1 3 3L8 19l-4 1z" />
      <line x1="13.5" y1="7.5" x2="16.5" y2="10.5" />
    </>
  ),
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  dumbbell: (
    <>
      <line x1="5" y1="9" x2="5" y2="15" />
      <line x1="8" y1="7.5" x2="8" y2="16.5" />
      <line x1="16" y1="7.5" x2="16" y2="16.5" />
      <line x1="19" y1="9" x2="19" y2="15" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.2" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.2" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  sunrise: (
    <>
      <path d="M8 15a4 4 0 0 1 8 0" />
      <line x1="12" y1="3" x2="12" y2="6" />
      <line x1="5" y1="8.5" x2="6.8" y2="10.3" />
      <line x1="19" y1="8.5" x2="17.2" y2="10.3" />
      <line x1="2.5" y1="15" x2="5" y2="15" />
      <line x1="19" y1="15" x2="21.5" y2="15" />
      <line x1="2.5" y1="19" x2="21.5" y2="19" />
    </>
  ),
  utensils: (
    <>
      <path d="M8 3v8M6 3v4a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M16 3c-1.5 1-2.5 3-2.5 5.5S15 13 16 13v8" />
    </>
  ),
  cookie: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="10" cy="10" r="0.9" />
      <circle cx="14.6" cy="11" r="0.9" />
      <circle cx="11" cy="15" r="0.9" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 0-2 2z" />
      <path d="M17.5 20a2 2 0 0 0-2-2H5" />
    </>
  ),
}

interface Props {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export default function AppIcon({ name, size = 20, strokeWidth = 1.8, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
