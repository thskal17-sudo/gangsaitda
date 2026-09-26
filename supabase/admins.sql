-- 강사잇다 · 관리자 명단 (admins)
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.
--
-- 이 명단에 있는 회원만 사이트의 관리자 화면(/admin)에 들어갈 수 있습니다.
-- 명단은 SQL Editor 에서만 고칠 수 있고, 사이트에서는 아무도 읽거나 고칠 수 없습니다.

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is '관리자 명단. SQL Editor 에서만 추가·삭제한다.';

-- 사이트에서는 명단을 직접 읽지도 고치지도 못한다 (규칙을 하나도 만들지 않음).
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 지금 로그인한 사람이 관리자인지 참/거짓만 알려주는 함수
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';
