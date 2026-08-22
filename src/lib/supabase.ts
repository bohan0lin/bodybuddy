import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 是否已正确配置 Supabase（未配置时 App 会显示引导页）
export const isConfigured = Boolean(url && anonKey)

// 未配置时用占位值创建，避免 import 阶段抛错；实际调用被 isConfigured 拦住
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')
