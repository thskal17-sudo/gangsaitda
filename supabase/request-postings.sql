-- 강사잇다 · 기관 담당자가 올리는 강사 모집 공고 (운영자 검토 뒤 게시)
-- request-matching.sql, request-portal.sql, member-type.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- 흐름
--   1) 기관 담당자가 '내 의뢰' 화면에서 의뢰 하나에 모집 공고(제목·마감일·내용·자격·서류)를 쓴다 → '검토 중'
--   2) 운영자가 관리자 화면에서 승인 또는 반려(사유). 승인하면 공고 표(jobs, job_details)에 들어가 공고 목록에 보인다.
--      승인은 '기관 확인됨' 의뢰만 된다.
--   3) 승인 뒤에는 담당자가 내용을 고칠 수 없고(운영자가 공고 관리에서 고침), '모집 마감'만 할 수 있다 (공고가 숨겨진다).
--      반려된 공고는 고쳐서 다시 낼 수 있다 (다시 '검토 중').
-- 공고에는 담당자 연락처가 들어가지 않는다. 지원은 강사잇다가 받는다 (프로필 등록 → 운영자 추천, 다음 단계에서 직접 지원).

-- 1) 공고 표에 '어느 의뢰에서 왔는지' 칸 --------------------------------------------------
alter table public.jobs
  add column if not exists request_id bigint references public.instructor_requests (id) on delete set null;
comment on column public.jobs.request_id is '기관 담당자가 올려 운영자가 승인한 공고면 그 의뢰 번호. 수집·운영자 등록 공고는 비어 있음';
create index if not exists jobs_request_idx on public.jobs (request_id);

-- 2) 모집 공고 표 (의뢰 하나에 하나) -----------------------------------------------------
create table if not exists public.request_postings (
  request_id     bigint primary key references public.instructor_requests (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  deadline       date not null,
  description    text not null check (char_length(btrim(description)) between 1 and 5000),
  qualifications text check (qualifications is null or char_length(qualifications) <= 2000),
  documents      text check (documents is null or char_length(documents) <= 500),
  status         text not null default '검토 중' check (status in ('검토 중', '승인', '반려')),
  review_note    text check (review_note is null or char_length(review_note) <= 500),  -- 반려 사유
  job_id         bigint references public.jobs (id) on delete set null,                -- 승인되어 올라간 공고 번호
  submitted_at   timestamptz not null default now(),
  reviewed_at    timestamptz,
  closed_at      timestamptz                                                            -- 담당자가 모집을 마감한 시각
);

comment on table public.request_postings is
  '기관 담당자가 쓴 강사 모집 공고. 운영자가 승인하면 jobs/job_details 에 복사되어 공고 목록에 보인다.';

alter table public.request_postings enable row level security;

-- 관리자만 표를 직접 읽는다. 담당자는 아래 my_posting 함수로 자기 것만 본다. 쓰기는 함수로만.
drop policy if exists "관리자는 모집 공고를 읽는다" on public.request_postings;
create policy "관리자는 모집 공고를 읽는다"
  on public.request_postings for select to authenticated
  using ((select public.is_admin()));

revoke all on public.request_postings from anon, authenticated;
grant select on public.request_postings to authenticated;

-- 3) 담당자: 내 의뢰의 모집 공고 읽기 -----------------------------------------------------
create or replace function public.my_posting(p_request_id bigint)
returns table (
  title text, deadline date, description text, qualifications text, documents text,
  status text, review_note text, job_id bigint, submitted_at timestamptz, reviewed_at timestamptz, closed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.title, p.deadline, p.description, p.qualifications, p.documents,
         p.status, p.review_note, p.job_id, p.submitted_at, p.reviewed_at, p.closed_at
  from public.request_postings p
  join public.instructor_requests r on r.id = p.request_id
  where p.request_id = p_request_id
    and r.requester_id = (select auth.uid());
$$;
revoke execute on function public.my_posting(bigint) from public, anon;
grant execute on function public.my_posting(bigint) to authenticated;

-- 4) 담당자: 모집 공고 쓰기·고치기 (승인 전·반려 뒤만). 저장하면 '검토 중' ----------------------
create or replace function public.save_my_posting(
  p_request_id     bigint,
  p_title          text,
  p_deadline       date,
  p_description    text,
  p_qualifications text default null,
  p_documents      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if not exists (select 1 from public.instructor_requests r where r.id = p_request_id and r.requester_id = (select auth.uid())) then
    raise exception '내 의뢰가 아닙니다' using errcode = '42501';
  end if;
  if p_deadline is null or p_deadline < (now() at time zone 'Asia/Seoul')::date then
    raise exception '마감일은 오늘 이후여야 합니다' using errcode = '22023';
  end if;

  select status into current_status from public.request_postings where request_id = p_request_id;
  if current_status = '승인' then
    raise exception '승인된 공고는 고칠 수 없습니다. 운영자에게 알려 주세요' using errcode = '22023';
  end if;

  insert into public.request_postings (request_id, title, deadline, description, qualifications, documents)
  values (p_request_id, btrim(p_title), p_deadline, btrim(p_description),
          nullif(btrim(p_qualifications), ''), nullif(btrim(p_documents), ''))
  on conflict (request_id) do update
    set title = excluded.title, deadline = excluded.deadline, description = excluded.description,
        qualifications = excluded.qualifications, documents = excluded.documents,
        status = '검토 중', review_note = null, submitted_at = now(), reviewed_at = null;
end;
$$;
revoke execute on function public.save_my_posting(bigint, text, date, text, text, text) from public, anon;
grant execute on function public.save_my_posting(bigint, text, date, text, text, text) to authenticated;

-- 5) 담당자: 모집 마감 (승인되어 올라간 공고를 숨긴다) ------------------------------------------
create or replace function public.close_my_posting(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  posted_job bigint;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select p.job_id into posted_job
  from public.request_postings p
  join public.instructor_requests r on r.id = p.request_id
  where p.request_id = p_request_id and r.requester_id = (select auth.uid())
    and p.status = '승인' and p.closed_at is null;
  if posted_job is null then
    raise exception '마감할 수 있는 공고가 없습니다' using errcode = 'P0002';
  end if;

  update public.jobs set hidden_at = coalesce(hidden_at, now()) where id = posted_job;
  update public.request_postings set closed_at = now() where request_id = p_request_id;
end;
$$;
revoke execute on function public.close_my_posting(bigint) from public, anon;
grant execute on function public.close_my_posting(bigint) to authenticated;

-- 6) 관리자: 승인(공고 올리기) 또는 반려(사유) ------------------------------------------------
-- 승인하면 의뢰의 기관명·지역·일정·대상·인원과 공고의 제목·마감일·내용·자격·서류로 공고를 만든다.
-- 연락처·지원 링크는 넣지 않는다 (지원은 강사잇다가 받는다).
create or replace function public.admin_review_posting(p_request_id bigint, p_approve boolean, p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.instructor_requests%rowtype;
  p public.request_postings%rowtype;
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  select * into r from public.instructor_requests where id = p_request_id;
  select * into p from public.request_postings where request_id = p_request_id;
  if r.id is null or p.request_id is null then
    raise exception '없는 공고입니다' using errcode = 'P0002';
  end if;
  if p.status <> '검토 중' then
    raise exception '검토 중인 공고만 처리할 수 있습니다' using errcode = '22023';
  end if;

  if not p_approve then
    update public.request_postings
    set status = '반려', review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now()
    where request_id = p_request_id;
    return null;
  end if;

  if r.org_verified_at is null then
    raise exception '기관 확인 뒤에 승인할 수 있습니다' using errcode = '22023';
  end if;

  insert into public.jobs (title, request_id) values (p.title, p_request_id) returning id into new_id;
  insert into public.job_details (job_id, organization, region, deadline, schedule, description, target, headcount, qualifications, documents)
  values (new_id, r.org_name, r.region, p.deadline, r.schedule, p.description, r.target, r.headcount, p.qualifications, p.documents);

  update public.request_postings
  set status = '승인', review_note = null, reviewed_at = now(), job_id = new_id, closed_at = null
  where request_id = p_request_id;
  return new_id;
end;
$$;
revoke execute on function public.admin_review_posting(bigint, boolean, text) from public, anon;
grant execute on function public.admin_review_posting(bigint, boolean, text) to authenticated;

-- 7) 담당자 '내 의뢰' 목록에 공고 상태 함께 주기 ----------------------------------------------
drop function if exists public.my_requests();
create function public.my_requests()
returns table (
  id bigint, created_at timestamptz, status text,
  org_name text, org_type text, region text, subject text, schedule text,
  target text, headcount integer, budget text, message text,
  verified boolean, more_requested boolean, more_note text,
  match_count integer, chosen_count integer, confirmed_count integer,
  posting_status text, posting_job_id bigint, posting_closed boolean
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
         p.status, p.job_id, p.closed_at is not null
  from public.instructor_requests r
  left join public.request_postings p on p.request_id = r.id
  where r.requester_id = (select auth.uid())
  order by r.id desc;
$$;
revoke execute on function public.my_requests() from public, anon;
grant execute on function public.my_requests() to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '기관 모집 공고 준비 완료' as 결과;
