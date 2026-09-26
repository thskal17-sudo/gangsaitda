-- 강사잇다 · 공고 표 두 개 (jobs, job_details)
-- Supabase 관리 화면 → SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.
--
-- 공고 하나를 넣는 순서
--   1) jobs 표에 제목을 적는다 → 번호(id)가 저절로 생긴다
--   2) job_details 표에 그 번호(job_id)와 나머지 내용을 적는다
--   ※ 2)까지 적어야 사이트에 나온다. 제목만 적힌 공고는 보이지 않는다.

-- 1) 누구나 볼 수 있는 표: 제목 -------------------------------------------
create table public.jobs (
  id         bigint generated always as identity primary key,
  title      text not null check (btrim(title) <> ''),
  created_at timestamptz not null default now()
);

comment on table public.jobs is '공고 제목. 비회원도 제목은 볼 수 있다. 나머지 내용은 job_details 에 적는다.';
comment on column public.jobs.title is '공고 제목 (필수)';

-- 2) 회원만 볼 수 있는 표: 나머지 전부 --------------------------------------
create table public.job_details (
  job_id         bigint primary key references public.jobs (id) on delete cascade,
  organization   text not null,  -- 기관명
  region         text not null,  -- 지역
  deadline       date not null,  -- 마감일 (예: 2026-10-02)
  source_url     text,           -- 원문 공고 주소
  schedule       text not null,  -- 수업 일정
  target         text,           -- 수업 대상
  headcount      integer check (headcount > 0),  -- 모집 인원
  description    text not null,  -- 상세 내용
  qualifications text,           -- 지원 자격 (한 줄에 하나씩)
  documents      text,           -- 제출 서류
  apply_url      text,           -- 지원서 링크
  apply_email    text,           -- 지원 이메일
  created_at     timestamptz not null default now()
  -- 지원 방법(링크·이메일)은 비워도 된다. 방문·우편 접수 공고는 원문에서 확인하도록 안내한다.
);

comment on table public.job_details is '공고 상세. 회원만 볼 수 있다. job_id 에 jobs 표의 번호를 적는다.';
comment on column public.job_details.job_id is 'jobs 표의 공고 번호 (필수)';
comment on column public.job_details.organization is '기관명 (필수)';
comment on column public.job_details.region is '지역 (필수). 예: 서울 마포구';
comment on column public.job_details.deadline is '마감일 (필수). 예: 2026-10-02';
comment on column public.job_details.source_url is '원문 공고 주소. https:// 로 시작';
comment on column public.job_details.schedule is '수업 일정 (필수). 예: 매주 화·목 14:00~15:30 (10주)';
comment on column public.job_details.target is '수업 대상. 예: 초등 3~4학년 약 20명';
comment on column public.job_details.headcount is '모집 인원 (숫자)';
comment on column public.job_details.description is '상세 내용 (필수). 줄바꿈 그대로 보임';
comment on column public.job_details.qualifications is '지원 자격. 한 줄에 하나씩';
comment on column public.job_details.documents is '제출 서류. 예: 이력서, 자격증 사본';
comment on column public.job_details.apply_url is '지원서 링크 (없으면 비워 둠)';
comment on column public.job_details.apply_email is '지원 이메일 (방문·우편 접수만 받으면 비워 둠)';

-- 3) 누가 읽고 쓸 수 있나 --------------------------------------------------
-- 두 표 모두 회원(로그인한 사람)만 직접 읽을 수 있다.
-- 비회원은 표를 직접 읽지 못하고, 아래 4)의 함수로 '번호와 제목'만 받는다.
-- 쓰기 규칙은 만들지 않는다 → 공고는 운영자만 관리 화면에서 넣고 고친다.
alter table public.jobs enable row level security;
alter table public.job_details enable row level security;

create policy "회원은 공고 제목을 읽는다"
  on public.jobs for select to authenticated using (true);

create policy "회원은 공고 상세를 읽는다"
  on public.job_details for select to authenticated using (true);

revoke all on public.jobs, public.job_details from anon;
revoke insert, update, delete, truncate on public.jobs, public.job_details from authenticated;

-- 4) 비회원에게 제목만 건네는 함수 -----------------------------------------
-- 마감일은 회원만 보는 표에 있지만, 목록을 '마감 가까운 순'으로 세우고
-- 마감 지난 공고를 빼려면 마감일이 필요하다. 그래서 데이터베이스 안에서
-- 순서만 정하고, 밖으로는 번호와 제목만 내보낸다.

-- 지원할 수 있는 공고 (마감 전) — 마감 가까운 순
create function public.open_job_titles(today date)
returns table (id bigint, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where d.deadline >= today
  order by d.deadline, j.id;
$$;

-- 공고 하나의 제목 (마감 지난 공고도 포함, 주소로 직접 들어온 경우)
create function public.job_title(job_id bigint)
returns table (id bigint, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where j.id = job_title.job_id;
$$;

revoke execute on function public.open_job_titles(date), public.job_title(bigint) from public;
grant execute on function public.open_job_titles(date), public.job_title(bigint) to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';
