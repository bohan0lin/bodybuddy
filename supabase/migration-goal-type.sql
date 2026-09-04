-- ════════════════════════════════════════════════════════════
-- BodyBuddy · 迁移：profiles 增加可选 goal_type（健康目标类别）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run（幂等、可安全重复）
-- 说明：可空、无默认值；已有用户的数值目标不受影响。
-- ════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists goal_type text;

-- 只允许固定取值或 null（幂等添加约束）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_goal_type_check') then
    alter table public.profiles
      add constraint profiles_goal_type_check
      check (goal_type in ('recomposition', 'fat_loss', 'muscle_gain', 'maintenance', 'performance'));
  end if;
end $$;
