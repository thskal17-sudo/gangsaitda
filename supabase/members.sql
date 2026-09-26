-- 강사잇다 · 회원 정보 표 (members)
-- Supabase 관리 화면 → SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.

-- 1) 표 만들기 ------------------------------------------------------------
create table public.members (
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text not null,
  phone             text not null,               -- 숫자만 저장 (예: 01012345678)
  email             text not null,
  grade             text not null default '무료', -- 회원 등급. 지금은 모두 '무료'
  privacy_agreed_at timestamptz not null,         -- 개인정보 수집·이용에 동의한 시각
  created_at        timestamptz not null default now()
);

comment on table public.members is '강사잇다 회원 정보. 가입하면 자동으로 한 줄 생긴다.';

-- 2) 누가 읽고 쓸 수 있나 --------------------------------------------------
-- 회원은 자기 정보 한 줄만 읽을 수 있다.
-- 쓰기(추가·수정·삭제) 규칙은 일부러 만들지 않는다 → 회원이 등급 등을 스스로 바꿀 수 없다.
alter table public.members enable row level security;

create policy "회원은 자기 정보만 읽는다"
  on public.members for select
  to authenticated
  using ((select auth.uid()) = id);

revoke insert, update, delete on public.members from anon, authenticated;

-- 3) 가입하면 자동으로 회원 정보 만들기 --------------------------------------
-- 가입 화면이 보낸 이름·연락처·동의 여부를 읽어 members 에 한 줄을 넣는다.
-- 동의가 없거나 이름·연락처가 비어 있으면 가입 자체를 거절한다
-- (화면을 거치지 않고 가입을 시도해도 막힌다).
create function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_name  text := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  member_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g');
begin
  if coalesce(new.raw_user_meta_data ->> 'privacy_agreed', '') <> 'true' then
    raise exception '개인정보 수집·이용 동의가 필요합니다';
  end if;
  if member_name = '' or member_phone = '' then
    raise exception '이름과 연락처가 필요합니다';
  end if;

  insert into public.members (id, name, phone, email, privacy_agreed_at)
  values (new.id, member_name, member_phone, new.email, now());
  return new;
end;
$$;

revoke execute on function public.handle_new_member() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_member();
