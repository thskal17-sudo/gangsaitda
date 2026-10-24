-- 강사잇다 · 강의 만족도 (기관 담당자가 남기고, 운영자만 본다)
-- request-postings.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 운영자가 의뢰를 '완료'로 바꾸면, 담당자가 '내 의뢰'에서 별점(1~5)과 한 줄 의견(선택, 300자)을 남긴다. 다시 고칠 수 있다.
-- - 관리자만 읽는다. 강사에게는 보이지 않는다.

-- 1) 만족도 표 (의뢰 하나에 하나) -----------------------------------------------------------
create table if not exists public.request_feedback (
  request_id bigint primary key references public.instructor_requests (id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.request_feedback is '강의 만족도. 완료된 의뢰에 담당자가 남긴 별점·의견. 관리자만 읽는다.';

alter table public.request_feedback enable row level security;

drop policy if exists "관리자는 만족도를 읽는다" on public.request_feedback;
create policy "관리자는 만족도를 읽는다"
  on public.request_feedback for select to authenticated
  using ((select public.is_admin()));

revoke all on public.request_feedback from anon, authenticated;
grant select on public.request_feedback to authenticated;

-- 2) 담당자: 내 만족도 읽기 / 남기기·고치기 ('완료'된 자기 의뢰만) ---------------------------------
create or replace function public.my_feedback(p_request_id bigint)
returns table (rating integer, comment text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.rating, f.comment, f.updated_at
  from public.request_feedback f
  join public.instructor_requests r on r.id = f.request_id
  where f.request_id = p_request_id and r.requester_id = (select auth.uid());
$$;
revoke execute on function public.my_feedback(bigint) from public, anon;
grant execute on function public.my_feedback(bigint) to authenticated;

create or replace function public.save_my_feedback(p_request_id bigint, p_rating integer, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if not exists (select 1 from public.instructor_requests r where r.id = p_request_id and r.requester_id = (select auth.uid())) then
    raise exception '내 의뢰가 아닙니다' using errcode = '42501';
  end if;
  if (select status from public.instructor_requests where id = p_request_id) <> '완료' then
    raise exception '완료된 의뢰에만 만족도를 남길 수 있습니다' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception '별점은 1~5 사이여야 합니다' using errcode = '22023';
  end if;

  insert into public.request_feedback (request_id, rating, comment)
  values (p_request_id, p_rating, nullif(btrim(coalesce(p_comment, '')), ''))
  on conflict (request_id) do update
    set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end;
$$;
revoke execute on function public.save_my_feedback(bigint, integer, text) from public, anon;
grant execute on function public.save_my_feedback(bigint, integer, text) to authenticated;

-- 3) 담당자 '내 의뢰' 목록에 만족도 함께 주기 -------------------------------------------------
drop function if exists public.my_requests();
create function public.my_requests()
returns table (
  id bigint, created_at timestamptz, status text,
  org_name text, org_type text, region text, subject text, schedule text,
  target text, headcount integer, budget text, message text,
  verified boolean, more_requested boolean, more_note text,
  match_count integer, chosen_count integer, confirmed_count integer,
  posting_status text, posting_job_id bigint, posting_closed boolean,
  feedback_rating integer
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
         f.rating
  from public.instructor_requests r
  left join public.request_postings p on p.request_id = r.id
  left join public.request_feedback f on f.request_id = r.id
  where r.requester_id = (select auth.uid())
  order by r.id desc;
$$;
revoke execute on function public.my_requests() from public, anon;
grant execute on function public.my_requests() to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '강의 만족도 준비 완료' as 결과;
