// 水合决策的纯逻辑，便于单测（不依赖 Supabase / React）

// 任意一次查询返回了错误，就视为「水合失败」——不能把查询错误当成空数据
export function hasHydrationError(errors: (unknown | null | undefined)[]): boolean {
  return errors.some((e) => e != null)
}

// 仅当 profiles 查询「成功且确无该行」（error 为空且 data 为空）时，才创建默认资料。
// 查询出错（error 非空）不算「无行」，绝不据此创建默认资料。
export function shouldInsertDefaultProfile(prof: { data: unknown; error: unknown }): boolean {
  return prof.error == null && prof.data == null
}
