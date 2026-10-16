-- 강사잇다 · 운영자가 직접 등록하는 강사 (사이트에 가입하지 않은 강사도 추천할 수 있게)
-- request-matching.sql, request-portal.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 운영자가 관리자 화면(/admin/profiles/new)에서 이름·연락처·분야·지역·프로필 파일을 올린다.
--   강사에게 기관 전달 동의를 따로(카톡·전화 등) 받았을 때만 저장할 수 있다 (동의 시각·방법을 남긴다).
-- - 등록한 강사는 가입한 강사와 똑같이 의뢰에 추천할 수 있고, 기관 담당자 화면에도 똑같이 보인다.
--   연락처는 '확정'된 강사만 기관에 보인다.
-- - 지우면 그 강사의 추천 줄도 함께 지워진다 (파일은 사이트가 지운다).

-- 1) 운영자 등록 강사 표 (관리자만 읽고 씀) -------------------------------------------
create table if not exists public.admin_instructors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 50),
  phone        text not null check (phone ~ '^0\d{8,10}$'),                -- 숫자만 (예: 01012345678)
  email        text check (email is null or char_length(email) <= 200),
  fields       text[] not null,
  regions      text[] not null,
  file_path    text not null check (file_path like 'admin/%'),             -- 저장소 instructor-profiles 의 admin 폴더
  file_name    text not null check (char_length(file_name) between 1 and 200),
  consent_at   timestamptz not null default now(),                        -- 강사에게 기관 전달 동의를 받았다고 운영자가 확인한 시각
  consent_note text check (consent_note is null or char_length(consent_note) <= 200), -- 동의 받은 방법 (예: 10/16 카톡)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint admin_instructors_fields_check
    check (cardinality(fields) between 1 and 10
           and fields <@ array['진로·창업', '코딩·AI', '방과후(예체능)', '방과후(교과)', '독서·논술',
                               '리더십·소통', '직무·CS', '인문·교양', '힐링·건강', '기타']),
  constraint admin_instructors_regions_check
    check (cardinality(regions) between 1 and 7
           and regions <@ array['전국구', '경기권', '강원권', '충청권', '전라권', '경상권', '제주권'])
);

comment on table public.admin_instructors is
  '운영자가 직접 등록한 강사 (사이트 미가입). 강사에게 기관 전달 동의를 받은 경우만. 관리자만 읽고 쓴다.';

alter table public.admin_instructors enable row level security;

drop policy if exists "관리자는 등록 강사를 다룬다" on public.admin_instructors;
create policy "관리자는 등록 강사를 다룬다"
  on public.admin_instructors for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.admin_instructors from anon, authenticated;
grant select, insert, update, delete on public.admin_instructors to authenticated;

-- 2) 추천 강사 표: 가입 강사(member_id) 또는 등록 강사(instructor_id) 둘 중 하나 -------------
alter table public.request_matches alter column member_id drop not null;
alter table public.request_matches
  add column if not exists instructor_id uuid references public.admin_instructors (id) on delete cascade;

alter table public.request_matches drop constraint if exists request_matches_one_instructor;
alter table public.request_matches add constraint request_matches_one_instructor
  check ((member_id is null) <> (instructor_id is null));

create unique index if not exists request_matches_request_instructor_key
  on public.request_matches (request_id, instructor_id) where instructor_id is not null;
create index if not exists request_matches_instructor_idx on public.request_matches (instructor_id);

-- 3) 담당자 함수: 등록 강사도 가입 강사와 똑같이 보이게 (연락처는 '확정'만) -----------------
drop function if exists public.my_request_matches(bigint);
create function public.my_request_matches(p_request_id bigint)
returns table (
  match_id bigint, status text, chosen boolean,
  name text, fields text[], regions text[], method text,
  career text, certificates text, intro text,
  file_name text, has_file boolean, plan_name text, has_plan boolean,
  phone text, email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.status, m.org_chosen_at is not null,
         coalesce(mb.name, ai.name), coalesce(p.fields, ai.fields), coalesce(p.regions, ai.regions), coalesce(p.method, 'file'),
         p.career, p.certificates, p.intro,
         coalesce(p.file_name, ai.file_name),
         case when m.member_id is not null then (p.method = 'file' and p.file_path is not null) else ai.file_path is not null end,
         m.plan_name, m.plan_path is not null,
         case when m.status = '확정' then coalesce(mb.phone, ai.phone) end,
         case when m.status = '확정' then coalesce(mb.email, ai.email) end
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and (p.member_id is not null or ai.id is not null)
  order by m.id;
$$;
revoke execute on function public.my_request_matches(bigint) from public, anon;
grant execute on function public.my_request_matches(bigint) to authenticated;

drop function if exists public.my_match_file(bigint, text);
create function public.my_match_file(p_match_id bigint, p_kind text)
returns table (bucket text, path text, file_name text, instructor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_kind = 'plan' then 'request-files' else 'instructor-profiles' end,
         case when p_kind = 'plan' then m.plan_path else coalesce(p.file_path, ai.file_path) end,
         case when p_kind = 'plan' then m.plan_name else coalesce(p.file_name, ai.file_name) end,
         coalesce(mb.name, ai.name)
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  where m.id = p_match_id
    and p_kind in ('plan', 'profile')
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and (case when p_kind = 'plan' then m.plan_path else coalesce(p.file_path, ai.file_path) end) is not null;
$$;
revoke execute on function public.my_match_file(bigint, text) from public, anon;
grant execute on function public.my_match_file(bigint, text) to authenticated;

-- 4) 저장소: 관리자는 프로필 저장소의 admin 폴더에 올리고 지울 수 있다 (읽기는 이미 됨) ------
drop policy if exists "관리자는 등록 강사 파일을 올린다" on storage.objects;
create policy "관리자는 등록 강사 파일을 올린다"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = 'admin' and (select public.is_admin()));

drop policy if exists "관리자는 등록 강사 파일을 지운다" on storage.objects;
create policy "관리자는 등록 강사 파일을 지운다"
  on storage.objects for delete to authenticated
  using (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = 'admin' and (select public.is_admin()));

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '강사 직접 등록 준비 완료' as 결과;
