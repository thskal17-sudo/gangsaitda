-- 강사잇다 · 강사별 강의 만족도 (확정된 강사마다 남기고, 요약은 다른 기관에도 보임)
-- profile-badges.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 운영자가 강사를 '확정'으로 바꾸면 기관 담당자 '내 의뢰'에 그 강사의 만족도 칸이 열린다 (의뢰가 '완료'되기를 기다리지 않는다).
--   별점(1~5) + 다시 부르고 싶은지(예/아니오) + 한 줄 의견(선택, 300자). 남긴 뒤에도 고칠 수 있다.
-- - 다른 기관이 그 강사를 추천받으면 **요약만** 보인다: 평가 건수, 평균 별점, 다시 부르고 싶다는 비율. 한 줄 의견은 운영자만 본다.
-- - 평가는 강사(회원번호 또는 운영자 등록번호)에 붙는다. 강사가 프로필을 지웠다 다시 내도 평가는 남고,
--   강사가 회원 탈퇴하거나 운영자 등록 강사를 지우면 함께 지워진다. 의뢰를 지워도(보관 기간 1년) 평가는 남는다.
-- - 예전 의뢰별 만족도(request_feedback)는 그대로 두고 관리자 화면에서만 보인다.

-- 1) 강사별 만족도 표 (관리자만 읽음, 쓰기는 아래 함수로만) ------------------------------------------
create table if not exists public.match_feedback (
  id            bigint generated always as identity primary key,
  match_id      bigint unique references public.request_matches (id) on delete set null,
  request_id    bigint references public.instructor_requests (id) on delete set null,
  member_id     uuid references public.members (id) on delete cascade,
  instructor_id uuid references public.admin_instructors (id) on delete cascade,
  rating        integer not null check (rating between 1 and 5),
  rehire        boolean not null,                       -- 다시 부르고 싶은지
  comment       text check (comment is null or char_length(comment) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint match_feedback_one_instructor check ((member_id is null) <> (instructor_id is null))
);

comment on table public.match_feedback is
  '강사별 강의 만족도. 확정된 강사에 기관 담당자가 남긴다. 요약(건수·평균·재섭외 비율)만 다른 기관에 보이고, 원문은 관리자만 읽는다.';

create index if not exists match_feedback_member_idx on public.match_feedback (member_id);
create index if not exists match_feedback_instructor_idx on public.match_feedback (instructor_id);

alter table public.match_feedback enable row level security;

drop policy if exists "관리자는 강사별 만족도를 읽는다" on public.match_feedback;
create policy "관리자는 강사별 만족도를 읽는다"
  on public.match_feedback for select to authenticated
  using ((select public.is_admin()));

revoke all on public.match_feedback from anon, authenticated;
grant select on public.match_feedback to authenticated;

-- 2) 담당자: 내 의뢰의 확정된 강사와 내가 남긴 만족도 (의뢰가 '완료'돼도 이름과 내 평가는 보인다) ------------
create or replace function public.my_match_feedbacks(p_request_id bigint)
returns table (match_id bigint, name text, rating integer, rehire boolean, comment text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, coalesce(mb.name, ai.name, '강사'), f.rating, f.rehire, f.comment, f.updated_at
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  left join public.match_feedback f on f.match_id = m.id
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and m.status = '확정'
  order by m.id;
$$;
revoke execute on function public.my_match_feedbacks(bigint) from public, anon;
grant execute on function public.my_match_feedbacks(bigint) to authenticated;

-- 3) 담당자: 확정된 강사의 만족도 남기기·고치기 ------------------------------------------------------
create or replace function public.save_match_feedback(p_match_id bigint, p_rating integer, p_rehire boolean, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request bigint;
  v_member uuid;
  v_instructor uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception '별점은 1~5 사이여야 합니다' using errcode = '22023';
  end if;
  if p_rehire is null then
    raise exception '다시 부르고 싶은지 골라 주세요' using errcode = '22023';
  end if;

  select m.request_id, m.member_id, m.instructor_id into v_request, v_member, v_instructor
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  where m.id = p_match_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and m.status = '확정';
  if v_request is null then
    raise exception '만족도를 남길 수 있는 강사가 아닙니다' using errcode = 'P0002';
  end if;

  insert into public.match_feedback (match_id, request_id, member_id, instructor_id, rating, rehire, comment)
  values (p_match_id, v_request, v_member, v_instructor, p_rating, p_rehire,
          nullif(left(btrim(coalesce(p_comment, '')), 300), ''))
  on conflict (match_id) do update
    set rating = excluded.rating, rehire = excluded.rehire, comment = excluded.comment, updated_at = now();
end;
$$;
revoke execute on function public.save_match_feedback(bigint, integer, boolean, text) from public, anon;
grant execute on function public.save_match_feedback(bigint, integer, boolean, text) to authenticated;

-- 4) 담당자 '내 의뢰' 목록: 만족도를 남길 강사 수와 남긴 수를 더한다 ------------------------------------
--    request-feedback.sql 의 함수와 같고, 맨 끝 두 칸(feedback_targets, feedback_done)만 늘었다.
drop function if exists public.my_requests();
create function public.my_requests()
returns table (
  id bigint, created_at timestamptz, status text,
  org_name text, org_type text, region text, subject text, schedule text,
  target text, headcount integer, budget text, message text,
  verified boolean, more_requested boolean, more_note text,
  match_count integer, chosen_count integer, confirmed_count integer,
  posting_status text, posting_job_id bigint, posting_closed boolean,
  feedback_rating integer,
  feedback_targets integer, feedback_done integer
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
         case when r.org_verified_at is null then 0 else (select count(*)::int from public.request_matches m where m.request_id = r.id and m.status = '확정') end,
         p.status, p.job_id, p.closed_at is not null,
         f.rating,
         case when r.org_verified_at is null then 0 else (select count(*)::int from public.request_matches m where m.request_id = r.id and m.status = '확정') end,
         case when r.org_verified_at is null then 0 else (
           select count(*)::int from public.request_matches m
           join public.match_feedback mf on mf.match_id = m.id
           where m.request_id = r.id and m.status = '확정') end
  from public.instructor_requests r
  left join public.request_postings p on p.request_id = r.id
  left join public.request_feedback f on f.request_id = r.id
  where r.requester_id = (select auth.uid())
  order by r.id desc;
$$;
revoke execute on function public.my_requests() from public, anon;
grant execute on function public.my_requests() to authenticated;

-- 5) 담당자 추천 강사: 그 강사의 평가 요약 세 칸을 더한다 ---------------------------------------------
--    profile-badges.sql 의 함수와 같고, 맨 끝 세 칸(review_count, review_avg, rehire_percent)만 늘었다.
drop function if exists public.my_request_matches(bigint);
create function public.my_request_matches(p_request_id bigint)
returns table (
  match_id bigint, status text, chosen boolean,
  name text, fields text[], regions text[], method text,
  career text, certificates text, intro text,
  file_name text, has_file boolean, plan_name text, has_plan boolean,
  phone text, email text,
  applied boolean, apply_message text,
  profile_checked boolean, plan_checked boolean,
  review_count integer, review_avg numeric, rehire_percent integer
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
         m.applied_at is not null, m.apply_message,
         coalesce(c.profile_key = case when p.member_id is not null
                                       then public.profile_content_key(p.method, p.career, p.certificates, p.intro, p.file_path)
                                       else public.profile_content_key('file', null, null, null, ai.file_path) end, false),
         coalesce(c.plan_path is not null and c.plan_path = p.sample_plan_path, false),
         fb.n, fb.avg_rating, fb.rehire_pct
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  left join public.profile_checks c on c.member_id = p.member_id or c.instructor_id = ai.id
  left join lateral (
    select count(*)::int as n,
           round(avg(f.rating), 1) as avg_rating,
           case when count(*) > 0 then round(100.0 * count(*) filter (where f.rehire) / count(*))::int end as rehire_pct
    from public.match_feedback f
    where (m.member_id is not null and f.member_id = m.member_id)
       or (m.instructor_id is not null and f.instructor_id = m.instructor_id)
  ) fb on true
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and r.status <> '완료'
    and (p.member_id is not null or ai.id is not null or m.applied_at is not null)
  order by m.id;
$$;
revoke execute on function public.my_request_matches(bigint) from public, anon;
grant execute on function public.my_request_matches(bigint) to authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '강사별 만족도 준비 완료' as 결과;
