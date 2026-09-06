import type { Database } from './database.types'

type TableName = keyof Database['public']['Tables']
export type DatabaseRow<T extends TableName> = Database['public']['Tables'][T]['Row']
export type DatabaseInsert<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type DatabaseUpdate<T extends TableName> = Database['public']['Tables'][T]['Update']
