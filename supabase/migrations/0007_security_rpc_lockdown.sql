-- =============================================================
-- 0007: 安全硬化補強（確保 promote_to_admin 無法被 anon/authenticated 呼叫）
-- 冪等；0006 已套用但 RPC 仍可能因預設 GRANT 而暴露時使用。
-- =============================================================

revoke all on function public.promote_to_admin(text) from public;
revoke all on function public.promote_to_admin(text) from anon, authenticated;

grant execute on function public.promote_to_admin(text) to postgres;
grant execute on function public.promote_to_admin(text) to service_role;

-- Supabase 部分專案另有 supabase_admin 角色
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    grant execute on function public.promote_to_admin(text) to supabase_admin;
  end if;
end $$;

notify pgrst, 'reload schema';
