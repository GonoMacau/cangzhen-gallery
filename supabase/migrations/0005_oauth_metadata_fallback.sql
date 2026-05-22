-- =============================================================
-- 0005: OAuth metadata fallback
-- 修補 LINE / Google 等第三方登入時 display_name / avatar_url
-- 抓不到的問題：
--   * LINE OIDC userinfo 使用 `name` / `picture`（非 `display_name` / `avatar_url`）
--   * LINE 沒有 email，所以原本的 split_part(email,'@',1) fallback 也是空字串
-- 同時對既有 NULL 的 profile 做一次回填。
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text;
  resolved_avatar text;
begin
  resolved_name := nullif(
    coalesce(
      meta->>'display_name',
      meta->>'full_name',
      meta->>'name',
      meta->>'preferred_username',
      meta->>'nickname',
      meta->>'user_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    ),
    ''
  );

  resolved_avatar := nullif(
    coalesce(
      meta->>'avatar_url',
      meta->>'picture',
      meta->>'picture_url'
    ),
    ''
  );

  if resolved_name is null then
    -- 最終 fallback：以 provider 名稱 + uid 末 6 碼組出可辨識的名稱
    -- e.g. "LINE 用戶 a1b2c3" / "用戶 a1b2c3"
    resolved_name := case
      when (meta->>'iss') ilike '%line%' then 'LINE 用戶 '
      else '用戶 '
    end || right(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, display_name, avatar_url, role)
  values (
    new.id,
    resolved_name,
    resolved_avatar,
    'guest'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =============================================================
-- 補建：對任何尚未有 profile row 的 auth.users 跑一次新 trigger 邏輯
-- （LINE 使用者於原 trigger 雖然沒報錯，但實際也可能因為其他舊 trigger 行為導致漏建）
-- =============================================================
insert into public.profiles (id, display_name, avatar_url, role)
select
  u.id,
  coalesce(
    nullif(
      coalesce(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'preferred_username',
        u.raw_user_meta_data->>'nickname',
        u.raw_user_meta_data->>'user_name',
        nullif(split_part(coalesce(u.email, ''), '@', 1), '')
      ),
      ''
    ),
    case
      when (u.raw_user_meta_data->>'iss') ilike '%line%' then 'LINE 用戶 '
      else '用戶 '
    end || right(replace(u.id::text, '-', ''), 6)
  ),
  nullif(
    coalesce(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'picture',
      u.raw_user_meta_data->>'picture_url'
    ),
    ''
  ),
  'guest'::public.user_role
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- =============================================================
-- 回填：display_name / avatar_url 為 NULL 的既有 profile row
-- =============================================================
update public.profiles p
set
  display_name = coalesce(
    p.display_name,
    nullif(
      coalesce(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'preferred_username',
        u.raw_user_meta_data->>'nickname',
        u.raw_user_meta_data->>'user_name',
        nullif(split_part(coalesce(u.email, ''), '@', 1), '')
      ),
      ''
    ),
    case
      when (u.raw_user_meta_data->>'iss') ilike '%line%' then 'LINE 用戶 '
      else '用戶 '
    end || right(replace(p.id::text, '-', ''), 6)
  ),
  avatar_url = coalesce(
    p.avatar_url,
    nullif(
      coalesce(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture',
        u.raw_user_meta_data->>'picture_url'
      ),
      ''
    )
  )
from auth.users u
where p.id = u.id
  and (p.display_name is null or p.avatar_url is null);
