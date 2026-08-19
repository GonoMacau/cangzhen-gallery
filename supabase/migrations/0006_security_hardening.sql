-- =============================================================
-- 0006: 安全硬化（privilege escalation / RPC / 私訊身份偽造）
-- 冪等；可重跑。
-- =============================================================

-- -----------------------------------------------------------------
-- 1. P0：鎖死 promote_to_admin 與 trigger 函式，禁止 anon/authenticated RPC
-- -----------------------------------------------------------------
revoke all on function public.promote_to_admin(text) from public;
revoke all on function public.promote_to_admin(text) from anon, authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_message() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- 注意：不可 REVOKE is_admin(uuid)，RLS policy 仍須呼叫它。

-- -----------------------------------------------------------------
-- 2. P1：禁止非 admin 修改 profiles 特權欄位（role / is_banned / banned_reason）
--    相容：SQL Editor（postgres）、service_role、既有 admin Server Action
-- -----------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.is_banned is distinct from old.is_banned
     or new.banned_reason is distinct from old.banned_reason then

    if coalesce(auth.jwt()->>'role', '') = 'service_role' then
      return new;
    end if;

    if session_user in ('postgres', 'supabase_admin') then
      return new;
    end if;

    if public.is_admin(auth.uid()) then
      return new;
    end if;

    raise exception 'Cannot change privileged profile columns';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- -----------------------------------------------------------------
-- 3. P1b：私訊 sender_role 由 DB 覆寫；禁言者不可發訊
-- -----------------------------------------------------------------
create or replace function public.enforce_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles%rowtype;
begin
  select * into prof from public.profiles where id = new.sender_id;
  if not found then
    raise exception 'Sender profile not found';
  end if;

  if prof.is_banned then
    raise exception 'Banned users cannot send messages';
  end if;

  new.sender_role := prof.role;
  return new;
end;
$$;

drop trigger if exists trg_enforce_message_sender on public.messages;
create trigger trg_enforce_message_sender
  before insert on public.messages
  for each row execute function public.enforce_message_sender();

-- -----------------------------------------------------------------
-- 4. P1b / P2b：限制 messages / conversations 的 UPDATE 欄位
-- -----------------------------------------------------------------
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.sender_role is distinct from old.sender_role
     or new.content is distinct from old.content
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify message fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update
  before update on public.messages
  for each row execute function public.guard_message_update();

create or replace function public.guard_conversation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- handle_new_message() 會連帶更新 last_message_at / 未讀數；須放行巢狀 trigger
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;

  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.guest_id is distinct from old.guest_id
     or new.unread_for_admin is distinct from old.unread_for_admin
     or new.subject is distinct from old.subject
     or new.created_at is distinct from old.created_at
     or new.last_message_at is distinct from old.last_message_at then
    raise exception 'Cannot modify conversation fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_conversation_update on public.conversations;
create trigger trg_guard_conversation_update
  before update on public.conversations
  for each row execute function public.guard_conversation_update();

-- -----------------------------------------------------------------
-- 5. RLS：收緊 comments / conversations / messages 寫入
-- -----------------------------------------------------------------

-- comments：一般使用者不可 update（僅 admin 審核）
drop policy if exists "comments user update own" on public.comments;
drop policy if exists "comments admin update" on public.comments;
create policy "comments admin update" on public.comments
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- conversations insert：禁言者不可建立對話
drop policy if exists "conversations guest insert" on public.conversations;
create policy "conversations guest insert" on public.conversations
for insert with check (
  auth.uid() = guest_id
  and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.is_banned = true
  )
);

-- messages insert：禁言者不可發訊（trigger 亦會擋）
drop policy if exists "messages participant insert" on public.messages;
create policy "messages participant insert" on public.messages
for insert with check (
  auth.uid() = sender_id
  and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.is_banned = true
  )
  and (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.guest_id = auth.uid()
    )
  )
);

notify pgrst, 'reload schema';
