-- 把每日目标的默认值改为 0（新用户注册后从 0 开始，自行设定）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run
-- 说明：只改「默认值」，不会动已有用户已设置的数值
alter table public.profiles alter column height_cm set default 0;
alter table public.profiles alter column target_protein set default 0;
alter table public.profiles alter column target_carbs set default 0;
alter table public.profiles alter column target_fat set default 0;
alter table public.profiles alter column target_calories set default 0;
