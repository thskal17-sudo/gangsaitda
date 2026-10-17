-- 강사잇다 · 회원 종류 (강사 / 기관) 나누기
-- members.sql, admins.sql, request-matching.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 가입할 때 '강사' 또는 '기관 담당자'를 고른다. 기관은 기관명도 적는다.
-- - 회원은 자기 종류를 바꿀 수 없다 (등급처럼). 관리자만 회원 화면(/admin/members)에서 바꾼다.
-- - 이미 가입한 회원: 강사섭외 의뢰를 낸 적 있으면 '기관', 나머지는 '강사' (칸을 처음 만들 때 한 번만 정한다).

-- 1) 회원 표에 칸 더하기 + 이미 가입한 회원 정리 (처음 한 번만) ---------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'members' and column_name = 'member_type'
  ) then
    alter table public.members
      add column member_type text not null default '강사' check (member_type in ('강사', '기관')),
      add column org_name    text check (org_name is null or char_length(org_name) between 1 and 50);

    update public.members m
    set member_type = '기관'
    where exists (select 1 from public.instructor_requests r where r.requester_id = m.id);
  end if;
end;
$$;

comment on column public.members.member_type is '회원 종류: 강사 / 기관. 가입할 때 고르고, 관리자만 바꾼다.';
comment on column public.members.org_name is '기관 회원의 기관명 (가입할 때 적음)';

-- 2) 가입하면 자동으로 회원 정보 만들기: 종류·기관명도 함께 --------------------------------
-- 종류가 없으면 '강사'로 본다 (이 SQL 을 실행한 뒤 사이트가 바뀌기 전까지의 가입도 막히지 않게).
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_name  text := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  member_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g');
  member_kind  text := coalesce(nullif(new.raw_user_meta_data ->> 'member_type', ''), '강사');
  member_org   text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'org_name', '')), '');
begin
  if coalesce(new.raw_user_meta_data ->> 'privacy_agreed', '') <> 'true' then
    raise exception '개인정보 수집·이용 동의가 필요합니다';
  end if;
  if member_name = '' or member_phone = '' then
    raise exception '이름과 연락처가 필요합니다';
  end if;
  if member_kind not in ('강사', '기관') then
    raise exception '회원 종류는 강사 또는 기관이어야 합니다';
  end if;
  if member_kind = '기관' and member_org is null then
    raise exception '기관명이 필요합니다';
  end if;

  insert into public.members (id, name, phone, email, privacy_agreed_at, member_type, org_name)
  values (new.id, member_name, member_phone, new.email, now(), member_kind,
          case when member_kind = '기관' then left(member_org, 50) end);
  return new;
end;
$$;

revoke execute on function public.handle_new_member() from public, anon, authenticated;

-- 3) 관리자: 회원 종류 바꾸기 ------------------------------------------------------------
create or replace function public.admin_set_member_type(p_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다';
  end if;
  if p_type not in ('강사', '기관') then
    raise exception '회원 종류는 강사 또는 기관이어야 합니다';
  end if;
  update public.members set member_type = p_type where id = p_id;
end;
$$;

revoke execute on function public.admin_set_member_type(uuid, text) from public, anon;
grant execute on function public.admin_set_member_type(uuid, text) to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '회원 종류 준비 완료' as 결과,
       count(*) filter (where member_type = '강사') as 강사_회원,
       count(*) filter (where member_type = '기관') as 기관_회원
from public.members;
