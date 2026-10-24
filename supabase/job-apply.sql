-- 강사잇다 · 공고에서 바로 지원하기 (기관이 올린 모집 공고에 강사 회원이 지원)
-- request-postings.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 강사 회원이 '강사잇다 모집' 공고에서 [지원하기]: 등록해 둔 프로필이 있으면 함께 가고,
--   프로필 파일·강의계획서 파일을 올릴 수 있다 (셋 중 하나는 있어야 한다). 한 공고에 한 번만.
-- - 지원자는 추천 강사 표(request_matches)에 상태 '지원'으로 들어가, 기관 담당자의 '내 의뢰'에
--   운영자 추천 강사와 같은 목록으로 보인다. 연락처는 지금처럼 '확정' 뒤에만.
-- - 지원 파일 자리: request-files 저장소의 의뢰번호/apply/회원번호/… (강사 본인만 올리고, 관리자가 읽는다)

-- 1) 추천 강사 표: 프로필이 없는 회원도 지원할 수 있게 회원 표를 가리킨다 ---------------------
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.request_matches'::regclass and contype = 'f'
      and conkey = array[(select attnum from pg_attribute where attrelid = 'public.request_matches'::regclass and attname = 'member_id')]
  loop
    execute format('alter table public.request_matches drop constraint %I', c);
  end loop;
end;
$$;
alter table public.request_matches
  add constraint request_matches_member_fkey foreign key (member_id) references public.members (id) on delete cascade;

-- 프로필을 지우면 운영자가 붙인 추천 줄은 전처럼 함께 지워진다 (강사가 직접 지원한 줄은 남는다)
create or replace function public.drop_recommendations_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.request_matches where member_id = old.member_id and applied_at is null;
  return old;
end;
$$;
revoke execute on function public.drop_recommendations_on_profile_delete() from public, anon, authenticated;

alter table public.request_matches
  add column if not exists applied_at         timestamptz,                       -- 비어 있으면 운영자 추천, 있으면 강사가 직접 지원
  add column if not exists apply_message      text check (apply_message is null or char_length(apply_message) <= 500),
  add column if not exists apply_profile_path text,                               -- 지원할 때 올린 프로필 파일 (request-files 저장소)
  add column if not exists apply_profile_name text check (apply_profile_name is null or char_length(apply_profile_name) <= 200);

drop trigger if exists instructor_profiles_drop_recommendations on public.instructor_profiles;
create trigger instructor_profiles_drop_recommendations
  after delete on public.instructor_profiles
  for each row execute function public.drop_recommendations_on_profile_delete();

-- 지원 파일도 강의계획서처럼 '의뢰번호/…' 아래에 둔다
alter table public.request_matches drop constraint if exists request_matches_apply_profile_check;
alter table public.request_matches add constraint request_matches_apply_profile_check check (
  apply_profile_path is null or apply_profile_path like request_id::text || '/apply/%'
);

-- 상태에 '지원' 추가
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.request_matches'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.request_matches drop constraint %I', c);
  end loop;
end;
$$;
alter table public.request_matches add constraint request_matches_status_check
  check (status in ('지원', '추천', '검토 중', '연락 중', '확정', '불발'));

comment on column public.request_matches.applied_at is '강사가 공고에서 직접 지원한 시각. 비어 있으면 운영자 추천';

-- 2) 저장소: 강사는 자기 지원 파일(의뢰번호/apply/회원번호/…)만 올리고 지운다. 읽기는 관리자(이미 됨)와 사이트 서버. ----
drop policy if exists "강사는 지원 파일을 올린다" on storage.objects;
create policy "강사는 지원 파일을 올린다"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'request-files'
              and (storage.foldername(name))[2] = 'apply'
              and (storage.foldername(name))[3] = (select auth.uid())::text);

drop policy if exists "강사는 지원 파일을 지운다" on storage.objects;
create policy "강사는 지원 파일을 지운다"
  on storage.objects for delete to authenticated
  using (bucket_id = 'request-files'
         and (storage.foldername(name))[2] = 'apply'
         and (storage.foldername(name))[3] = (select auth.uid())::text);

-- 3) 강사: 이 공고에 이미 지원했는지 ---------------------------------------------------------
create or replace function public.my_application(p_job_id bigint)
returns table (match_id bigint, applied_at timestamptz, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.applied_at, m.status
  from public.request_matches m
  join public.jobs j on j.request_id = m.request_id
  where j.id = p_job_id and m.member_id = (select auth.uid()) and m.applied_at is not null;
$$;
revoke execute on function public.my_application(bigint) from public, anon;
grant execute on function public.my_application(bigint) to authenticated;

-- 4) 강사: 지원하기 ---------------------------------------------------------------------------
create or replace function public.apply_to_posting(
  p_job_id       bigint,
  p_message      text default null,
  p_profile_path text default null,
  p_profile_name text default null,
  p_plan_path    text default null,
  p_plan_name    text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  req bigint;
  hidden timestamptz;
  due date;
  new_id bigint;
begin
  if uid is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if (select member_type from public.members where id = uid) <> '강사' then
    raise exception '강사 회원만 지원할 수 있습니다' using errcode = '42501';
  end if;

  select j.request_id, j.hidden_at, d.deadline into req, hidden, due
  from public.jobs j join public.job_details d on d.job_id = j.id
  where j.id = p_job_id;
  if req is null then
    raise exception '강사잇다에서 지원을 받는 공고가 아닙니다' using errcode = 'P0002';
  end if;
  if hidden is not null or due < (now() at time zone 'Asia/Seoul')::date then
    raise exception '마감된 공고입니다' using errcode = '22023';
  end if;

  if not exists (select 1 from public.instructor_profiles where member_id = uid)
     and p_profile_path is null and p_plan_path is null then
    raise exception '프로필이나 강의계획서 중 하나는 있어야 합니다' using errcode = '22023';
  end if;
  if p_profile_path is not null and p_profile_path not like req::text || '/apply/' || uid::text || '/%' then
    raise exception '파일을 다시 올려 주세요' using errcode = '22023';
  end if;
  if p_plan_path is not null and p_plan_path not like req::text || '/apply/' || uid::text || '/%' then
    raise exception '파일을 다시 올려 주세요' using errcode = '22023';
  end if;

  begin
    insert into public.request_matches (request_id, member_id, status, applied_at, apply_message, apply_profile_path, apply_profile_name, plan_path, plan_name)
    values (req, uid, '지원', now(), nullif(btrim(coalesce(p_message, '')), ''),
            p_profile_path, case when p_profile_path is null then null else left(coalesce(nullif(btrim(p_profile_name), ''), '프로필'), 200) end,
            p_plan_path, case when p_plan_path is null then null else left(coalesce(nullif(btrim(p_plan_name), ''), '강의계획서'), 200) end)
    returning id into new_id;
  exception when unique_violation then
    raise exception '이미 지원한 공고입니다' using errcode = '23505';
  end;
  return new_id;
end;
$$;
revoke execute on function public.apply_to_posting(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.apply_to_posting(bigint, text, text, text, text, text) to authenticated;

-- 5) 담당자 함수: 지원자도 추천 강사와 같은 목록에 (프로필이 없는 지원자는 올린 파일로) ----------
drop function if exists public.my_request_matches(bigint);
create function public.my_request_matches(p_request_id bigint)
returns table (
  match_id bigint, status text, chosen boolean,
  name text, fields text[], regions text[], method text,
  career text, certificates text, intro text,
  file_name text, has_file boolean, plan_name text, has_plan boolean,
  phone text, email text,
  applied boolean, apply_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.status, m.org_chosen_at is not null,
         coalesce(mb.name, ai.name),
         coalesce(p.fields, ai.fields, '{}'::text[]), coalesce(p.regions, ai.regions, '{}'::text[]),
         coalesce(p.method, 'file'),
         p.career, p.certificates, p.intro,
         coalesce(p.file_name, m.apply_profile_name, ai.file_name),
         case when m.member_id is not null then ((p.method = 'file' and p.file_path is not null) or m.apply_profile_path is not null)
              else ai.file_path is not null end,
         m.plan_name, m.plan_path is not null,
         case when m.status = '확정' then coalesce(mb.phone, ai.phone) end,
         case when m.status = '확정' then coalesce(mb.email, ai.email) end,
         m.applied_at is not null, m.apply_message
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and (p.member_id is not null or ai.id is not null or m.applied_at is not null)
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
  select case when p_kind = 'plan' then 'request-files'
              when p.file_path is not null then 'instructor-profiles'
              when m.apply_profile_path is not null then 'request-files'
              else 'instructor-profiles' end,
         case when p_kind = 'plan' then m.plan_path else coalesce(p.file_path, m.apply_profile_path, ai.file_path) end,
         case when p_kind = 'plan' then m.plan_name else coalesce(p.file_name, m.apply_profile_name, ai.file_name) end,
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
    and (case when p_kind = 'plan' then m.plan_path else coalesce(p.file_path, m.apply_profile_path, ai.file_path) end) is not null;
$$;
revoke execute on function public.my_match_file(bigint, text) from public, anon;
grant execute on function public.my_match_file(bigint, text) to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '공고 지원 준비 완료' as 결과;
