-- 강사잇다 · 기관 담당자 '내 의뢰' 화면 (운영자 추천형 ②)
-- request-matching.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- - 운영자가 추천 강사마다 강의계획서 파일을 올린다 (관리자 화면).
-- - 의뢰를 낸 담당자는 '기관 확인됨' 의뢰에서만 추천 강사의 프로필·강의계획서를 본다.
--   강사 연락처(전화·이메일)는 운영자가 '확정'으로 바꾼 강사만 보인다.
-- - 담당자는 강사마다 '이 강사님으로 할게요'(선택·취소), 의뢰 전체에 '다른 강사를 원해요'(한 줄 의견)를 누른다.
-- - 담당자는 표를 직접 읽지 못하고, 아래 함수들이 '자기 의뢰인지, 기관 확인됐는지'를 확인한 뒤 필요한 칸만 돌려준다.

-- 1) 추천 강사 표: 강의계획서 파일, 기관 선택 ---------------------------------------
alter table public.request_matches
  add column if not exists plan_path text,
  add column if not exists plan_name text,
  add column if not exists org_chosen_at timestamptz;

alter table public.request_matches drop constraint if exists request_matches_plan_check;
alter table public.request_matches add constraint request_matches_plan_check check (
  (plan_path is null or plan_path like request_id::text || '/%')
  and (plan_name is null or char_length(plan_name) <= 200)
);

comment on column public.request_matches.plan_path is '강의계획서 파일 자리 (저장소 request-files, 의뢰번호 폴더). 운영자가 올린다.';
comment on column public.request_matches.org_chosen_at is '기관 담당자가 이 강사를 고른 시각. 비어 있으면 고르지 않음.';

-- 관리자는 강의계획서 칸을 고칠 수 있다 (기관 선택 칸은 아래 함수로만)
grant update (plan_path, plan_name) on public.request_matches to authenticated;

-- 2) 의뢰 표: 다른 강사 요청 ---------------------------------------------------------
alter table public.instructor_requests
  add column if not exists more_requested_at timestamptz,
  add column if not exists more_note text;

alter table public.instructor_requests drop constraint if exists instructor_requests_more_note_check;
alter table public.instructor_requests add constraint instructor_requests_more_note_check
  check (more_note is null or char_length(more_note) <= 300);

comment on column public.instructor_requests.more_requested_at is
  '담당자가 다른 강사를 원한 시각. 운영자가 새 강사를 추천하면 비워진다.';

-- 운영자가 새 강사를 추천하면 '다른 강사 요청' 표시를 지운다 (한 줄 의견은 남겨 둔다)
create or replace function public.clear_more_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.instructor_requests set more_requested_at = null where id = new.request_id;
  return new;
end;
$$;
revoke execute on function public.clear_more_request() from public, anon, authenticated;

drop trigger if exists request_matches_clear_more on public.request_matches;
create trigger request_matches_clear_more
  after insert on public.request_matches
  for each row execute function public.clear_more_request();

-- 3) 담당자: 내 의뢰 목록 (자기가 낸 의뢰만) -------------------------------------------
drop function if exists public.my_requests();
create function public.my_requests()
returns table (
  id bigint, created_at timestamptz, status text,
  org_name text, org_type text, region text, subject text, schedule text,
  target text, headcount integer, budget text, message text,
  verified boolean, more_requested boolean, more_note text,
  match_count integer, chosen_count integer, confirmed_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.created_at, r.status,
         r.org_name, r.org_type, r.region, r.subject, r.schedule,
         r.target, r.headcount, r.budget, r.message,
         r.org_verified_at is not null, r.more_requested_at is not null, r.more_note,
         -- 기관 확인 전에는 추천 수도 알려 주지 않는다
         case when r.org_verified_at is null then 0 else (select count(*)::int from public.request_matches m where m.request_id = r.id) end,
         case when r.org_verified_at is null then 0 else (select count(*)::int from public.request_matches m where m.request_id = r.id and m.org_chosen_at is not null) end,
         case when r.org_verified_at is null then 0 else (select count(*)::int from public.request_matches m where m.request_id = r.id and m.status = '확정') end
  from public.instructor_requests r
  where r.requester_id = (select auth.uid())
  order by r.id desc;
$$;
revoke execute on function public.my_requests() from public, anon;
grant execute on function public.my_requests() to authenticated;

-- 4) 담당자: 의뢰 하나의 추천 강사 (기관 확인된 자기 의뢰만. 연락처는 '확정' 강사만) ----------
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
         mb.name, p.fields, p.regions, p.method,
         p.career, p.certificates, p.intro,
         p.file_name, (p.method = 'file' and p.file_path is not null), m.plan_name, m.plan_path is not null,
         case when m.status = '확정' then mb.phone end,
         case when m.status = '확정' then mb.email end
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  join public.instructor_profiles p on p.member_id = m.member_id
  join public.members mb on mb.id = m.member_id
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
  order by m.id;
$$;
revoke execute on function public.my_request_matches(bigint) from public, anon;
grant execute on function public.my_request_matches(bigint) to authenticated;

-- 5) 담당자: 내려받을 파일 자리 (프로필 파일 또는 강의계획서). 사이트 서버가 이걸 확인한 뒤 1분짜리 주소를 만든다.
drop function if exists public.my_match_file(bigint, text);
create function public.my_match_file(p_match_id bigint, p_kind text)
returns table (bucket text, path text, file_name text, instructor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_kind = 'plan' then 'request-files' else 'instructor-profiles' end,
         case when p_kind = 'plan' then m.plan_path else p.file_path end,
         case when p_kind = 'plan' then m.plan_name else p.file_name end,
         mb.name
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  join public.instructor_profiles p on p.member_id = m.member_id
  join public.members mb on mb.id = m.member_id
  where m.id = p_match_id
    and p_kind in ('plan', 'profile')
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and (case when p_kind = 'plan' then m.plan_path else p.file_path end) is not null;
$$;
revoke execute on function public.my_match_file(bigint, text) from public, anon;
grant execute on function public.my_match_file(bigint, text) to authenticated;

-- 6) 담당자: '이 강사님으로 할게요' / 취소 ---------------------------------------------
create or replace function public.choose_match(p_match_id bigint, p_chosen boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.request_matches m
  set org_chosen_at = case when p_chosen then coalesce(m.org_chosen_at, now()) else null end
  from public.instructor_requests r
  where m.id = p_match_id
    and r.id = m.request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null;
  if not found then
    raise exception '고를 수 없는 강사입니다.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.choose_match(bigint, boolean) from public, anon;
grant execute on function public.choose_match(bigint, boolean) to authenticated;

-- 7) 담당자: '다른 강사를 원해요' (한 줄 의견, 300자까지) -----------------------------------
create or replace function public.request_more_instructors(p_request_id bigint, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.instructor_requests
  set more_requested_at = now(),
      more_note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
  where id = p_request_id
    and requester_id = (select auth.uid())
    and org_verified_at is not null;
  if not found then
    raise exception '요청할 수 없는 의뢰입니다.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.request_more_instructors(bigint, text) from public, anon;
grant execute on function public.request_more_instructors(bigint, text) to authenticated;

-- 8) 강의계획서 저장소 (공개 안 함, 한 파일 10MB 까지). 관리자만 올리고 읽고 지운다.
--    담당자는 저장소를 직접 읽지 못하고, 사이트 서버가 5)로 확인한 뒤 1분짜리 주소를 만들어 준다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('request-files', 'request-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "관리자는 강의계획서를 올린다" on storage.objects;
create policy "관리자는 강의계획서를 올린다"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'request-files' and (select public.is_admin()));

drop policy if exists "관리자는 강의계획서를 읽는다" on storage.objects;
create policy "관리자는 강의계획서를 읽는다"
  on storage.objects for select to authenticated
  using (bucket_id = 'request-files' and (select public.is_admin()));

drop policy if exists "관리자는 강의계획서를 지운다" on storage.objects;
create policy "관리자는 강의계획서를 지운다"
  on storage.objects for delete to authenticated
  using (bucket_id = 'request-files' and (select public.is_admin()));

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '내 의뢰 화면 준비 완료' as 결과;
