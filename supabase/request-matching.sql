-- 강사잇다 · 강사섭외 의뢰에 추천 강사 붙이기 (운영자 추천형 ① 관리자)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 의뢰가 들어오면 운영자가 관리자 화면(/admin/requests/의뢰번호)에서
--   - 기관이 진짜인지 확인한 뒤 '기관 확인됨' 표시를 하고,
--   - 의뢰에 맞는 강사 프로필을 골라 '추천 강사'로 붙이고,
--   - 강사마다 진행 상태(추천 / 검토 중 / 연락 중 / 확정 / 불발)를 바꿉니다.
-- 지금은 관리자만 보고 씁니다. 다음 단계에서 의뢰를 낸 담당자가 '기관 확인됨' 의뢰의 추천 강사를 보게 합니다
-- (그래서 의뢰를 누가 냈는지도 이번에 함께 적어 둡니다).
--
-- 개인정보: 강사가 프로필을 지우면(동의 철회) 그 강사의 추천 줄도 함께 지워집니다.
--           의뢰를 지우면(처리 완료 후 1년) 추천 줄도 함께 지워집니다.

-- 1) 의뢰 표에 두 칸 ----------------------------------------------------------
-- requester_id: 의뢰를 낸 회원. 의뢰서를 보낼 때 데이터베이스가 로그인한 회원 번호로 자동으로 채운다.
-- org_verified_at: 운영자가 기관을 확인한 시각. 비어 있으면 '확인 전'.
alter table public.instructor_requests
  add column if not exists requester_id uuid default auth.uid() references public.members (id) on delete set null,
  add column if not exists org_verified_at timestamptz;

comment on column public.instructor_requests.requester_id is '의뢰를 낸 회원 (보낼 때 자동으로 채움). 탈퇴하면 비움.';
comment on column public.instructor_requests.org_verified_at is '운영자가 기관을 확인한 시각. 비어 있으면 확인 전.';

-- 이미 받은 의뢰: 담당자 이메일과 같은 이메일로 가입한 회원을 의뢰자로 적는다 (비어 있는 것만).
update public.instructor_requests r
set requester_id = m.id
from public.members m
where r.requester_id is null
  and lower(m.email) = lower(r.contact_email);

-- 의뢰서 보내기 규칙: 자기 이름으로만, 확인 표시 없이 보낼 수 있다.
drop policy if exists "회원만 강사섭외 의뢰를 보낸다" on public.instructor_requests;
create policy "회원만 강사섭외 의뢰를 보낸다"
  on public.instructor_requests for insert
  to authenticated
  with check (status = '접수' and requester_id = (select auth.uid()) and org_verified_at is null);

-- 2) 기관 확인 표시 (관리자만) --------------------------------------------------
create or replace function public.admin_set_request_verified(p_id bigint, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 기관 확인을 할 수 있습니다.' using errcode = '42501';
  end if;

  update public.instructor_requests
  set org_verified_at = case when p_verified then coalesce(org_verified_at, now()) else null end
  where id = p_id;
  if not found then
    raise exception '없는 의뢰입니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_set_request_verified(bigint, boolean) from public, anon;
grant execute on function public.admin_set_request_verified(bigint, boolean) to authenticated;

-- 3) 추천 강사 표 ---------------------------------------------------------------
-- 의뢰 하나에 강사 여러 명. 같은 강사를 같은 의뢰에 두 번 붙이지 않는다.
-- 강사는 프로필을 낸(기관 전달에 동의한) 회원만 붙일 수 있다 (프로필 표를 가리킨다).
create table if not exists public.request_matches (
  id          bigint generated always as identity primary key,
  request_id  bigint not null references public.instructor_requests (id) on delete cascade,
  member_id   uuid not null references public.instructor_profiles (member_id) on delete cascade,
  status      text not null default '추천' check (status in ('추천', '검토 중', '연락 중', '확정', '불발')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (request_id, member_id)
);

comment on table public.request_matches is
  '의뢰별 추천 강사. 운영자가 붙이고 상태를 바꾼다. 강사가 프로필을 지우거나 의뢰가 지워지면 함께 지워진다.';

create index if not exists request_matches_member_idx on public.request_matches (member_id);

-- 누가 무엇을 할 수 있나: 지금은 관리자만 읽고 쓴다.
alter table public.request_matches enable row level security;

drop policy if exists "관리자는 추천 강사를 다룬다" on public.request_matches;
create policy "관리자는 추천 강사를 다룬다"
  on public.request_matches for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.request_matches from anon, authenticated;
grant select, insert, delete on public.request_matches to authenticated;
grant update (status, updated_at) on public.request_matches to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '추천 강사 준비 완료' as 결과;
