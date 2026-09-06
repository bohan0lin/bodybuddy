-- 给常用食物/套餐与餐食记录加「品牌」字段（可选）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run（可重复运行）
alter table public.saved_items add column if not exists brand text;
alter table public.meals add column if not exists brand text;
