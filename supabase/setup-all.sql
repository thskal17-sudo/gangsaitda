-- 강사잇다 · 새 Supabase 프로젝트 한 번에 설치하기 (전체 표·규칙·함수)
-- 빈 새 프로젝트의 SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다. 결과에 Success 가 나오면 끝입니다.
-- 중간에 하나라도 오류가 나면 아무것도 만들어지지 않습니다 (전부 되돌림). 오류 문구를 그대로 알려 주세요.
--
-- 아래 파일들을 순서대로 이어 붙인 것입니다. 각 파일을 따로 실행할 필요는 없습니다.
--   members.sql, jobs.sql, find-email.sql, instructor-requests.sql, instructor-requests-change-1.sql, today-job-count.sql, today-job-titles.sql, admins.sql, admin-job-create.sql, admin-job-edit.sql, admin-requests.sql, admin-members.sql, delete-account.sql, today-deadline-count.sql, instructor-requests-change-2.sql, instructor-profiles.sql, job-import.sql, job-region-group.sql, kakao-notify.sql
-- (jobs-change-1.sql, jobs-change-2.sql 은 jobs.sql 에 이미 반영되어 있어 뺐습니다.
--  admin-add.sql, admin-reset-password.sql 은 운영자가 그때그때 쓰는 파일이라 뺐습니다.)

begin;

-- ============================================================
-- members.sql
-- ============================================================

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

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- jobs.sql
-- ============================================================

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

-- ============================================================
-- find-email.sql
-- ============================================================

-- 강사잇다 · 이메일(아이디) 찾기
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 이름과 연락처가 모두 맞는 회원의 이메일을 **가려서** 돌려줍니다. 예) abcd@naver.com → ab***@naver.com
-- 가리는 일은 데이터베이스 안에서 하므로, 전체 이메일은 밖으로 나가지 않습니다.

create or replace function public.find_member_email(member_name text, member_phone text)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when length(split_part(m.email, '@', 1)) <= 2
        then left(m.email, 1) || '***@' || split_part(m.email, '@', 2)
      else left(m.email, 2) || '***@' || split_part(m.email, '@', 2)
    end
  from public.members m
  where m.name = btrim(find_member_email.member_name)
    and m.phone = regexp_replace(coalesce(find_member_email.member_phone, ''), '\D', '', 'g')
    and btrim(coalesce(find_member_email.member_name, '')) <> ''
  order by m.created_at;
$$;

revoke execute on function public.find_member_email(text, text) from public;
grant execute on function public.find_member_email(text, text) to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- instructor-requests.sql
-- ============================================================

-- 강사잇다 · 강사섭외 의뢰 표 (instructor_requests)
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.
--
-- 학교·기관이 '강사섭외' 화면에서 보낸 의뢰가 한 줄씩 쌓입니다. 운영자는 Table Editor 에서 봅니다.
-- 누구나(로그인 없이) 보낼 수 있지만, 보낸 사람을 포함해 **아무도 사이트에서 읽을 수 없습니다.**

create table public.instructor_requests (
  id                bigint generated always as identity primary key,
  org_name          text not null check (char_length(btrim(org_name)) between 1 and 100),   -- 기관명
  org_type          text not null check (org_type in ('학교', '공공기관', '기업', '복지관·센터', '기타')),
  region            text not null check (char_length(btrim(region)) between 1 and 50),      -- 지역
  contact_name      text not null check (char_length(btrim(contact_name)) between 1 and 30), -- 담당자 이름
  contact_phone     text not null check (contact_phone ~ '^0\d{8,10}$'),                    -- 숫자만
  contact_email     text not null check (char_length(contact_email) between 3 and 100 and contact_email like '%_@_%'),
  subject           text not null check (char_length(btrim(subject)) between 1 and 200),     -- 필요한 분야·과목
  schedule          text not null check (char_length(btrim(schedule)) between 1 and 500),    -- 희망 일정
  target            text check (target is null or char_length(target) <= 200),              -- 수업 대상
  headcount         integer check (headcount is null or headcount between 1 and 100),       -- 필요한 강사 수
  budget            text check (budget is null or char_length(budget) <= 200),              -- 예산(강사료)
  message           text check (message is null or char_length(message) <= 2000),          -- 요청 사항
  privacy_agreed_at timestamptz not null default now(),                                      -- 개인정보 동의 시각
  status            text not null default '접수' check (status in ('접수', '처리 중', '완료')), -- 운영자가 바꿈
  created_at        timestamptz not null default now()
);

comment on table public.instructor_requests is
  '강사섭외 의뢰. 사이트에서는 보내기만 되고 읽을 수 없다. 개인정보(담당자 이름·연락처·이메일)는 처리 완료 후 1년이 지나면 지운다.';
comment on column public.instructor_requests.status is '접수 / 처리 중 / 완료 — 운영자가 Table Editor 에서 바꿈';

-- 누가 무엇을 할 수 있나: 보내기(추가)만. 읽기·고치기·지우기 규칙은 만들지 않는다.
alter table public.instructor_requests enable row level security;

create policy "누구나 강사섭외 의뢰를 보낸다"
  on public.instructor_requests for insert
  to anon, authenticated
  with check (status = '접수');

revoke all on public.instructor_requests from anon, authenticated;
grant insert (org_name, org_type, region, contact_name, contact_phone, contact_email,
              subject, schedule, target, headcount, budget, message)
  on public.instructor_requests to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- instructor-requests-change-1.sql
-- ============================================================

-- 강사잇다 · 강사섭외 의뢰 표 고치기 ① 담당자 이메일을 필수로
-- instructor-requests.sql 을 이미 실행한 경우에 SQL Editor 에서 한 번 실행합니다.
-- "contains null values" 오류가 나면: 이메일 없이 들어온 의뢰(시험 의뢰 등)가 있다는 뜻입니다.
-- Table Editor 에서 그 줄에 이메일을 적거나 지운 뒤 다시 실행하세요.

alter table public.instructor_requests
  alter column contact_email set not null,
  drop constraint if exists instructor_requests_contact_email_check,
  add constraint instructor_requests_contact_email_check
    check (char_length(contact_email) between 3 and 100 and contact_email like '%_@_%');

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- today-job-count.sql
-- ============================================================

-- 강사잇다 · 오늘 올라온 공고 수 (홈 화면)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 한국 날짜로 오늘 등록된 공고 중, 아직 마감되지 않은 공고의 **개수만** 돌려줍니다.
-- 비회원도 부를 수 있지만 공고 내용은 전혀 내주지 않습니다.

create or replace function public.today_job_count(today date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where (j.created_at at time zone 'Asia/Seoul')::date = today_job_count.today
    and d.deadline >= today_job_count.today;
$$;

revoke execute on function public.today_job_count(date) from public;
grant execute on function public.today_job_count(date) to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- today-job-titles.sql
-- ============================================================

-- 강사잇다 · 오늘 올라온 공고 목록 (홈의 '오늘 올라온 공고 N건'을 누르면 보이는 목록)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 한국 날짜로 오늘 등록된 공고 중 아직 마감되지 않은 공고의 **번호·제목만** 돌려줍니다 (마감 가까운 순).
-- 세는 기준은 today-job-count.sql 과 같습니다. 비회원도 부를 수 있지만 제목 말고는 내주지 않습니다.

create or replace function public.today_job_titles(today date)
returns table (id bigint, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where (j.created_at at time zone 'Asia/Seoul')::date = today_job_titles.today
    and d.deadline >= today_job_titles.today
  order by d.deadline, j.id;
$$;

revoke execute on function public.today_job_titles(date) from public;
grant execute on function public.today_job_titles(date) to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- admins.sql
-- ============================================================

-- 강사잇다 · 관리자 명단 (admins)
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 그대로 두거나 새로 덮어씁니다).
-- 맨 아래 결과에 관리자 수가 나옵니다. 0 이면 admin-add.sql 로 관리자를 지정하세요.
--
-- 이 명단에 있는 회원만 사이트의 관리자 화면(/admin)에 들어갈 수 있습니다.
-- 명단은 SQL Editor 에서만 고칠 수 있고, 사이트에서는 아무도 읽거나 고칠 수 없습니다.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is '관리자 명단. SQL Editor 에서만 추가·삭제한다.';

-- 사이트에서는 명단을 직접 읽지도 고치지도 못한다 (규칙을 하나도 만들지 않음).
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 지금 로그인한 사람이 관리자인지 참/거짓만 알려주는 함수
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- 확인: 지금 관리자로 지정된 회원 수
select count(*) as 관리자_수 from public.admins;

-- ============================================================
-- admin-job-create.sql
-- ============================================================

-- 강사잇다 · 관리자 화면에서 공고 올리기
-- admins.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.
--
-- 공고 표(jobs, job_details)는 여전히 사이트에서 직접 고칠 수 없습니다.
-- 대신 이 함수 하나로만 공고를 올릴 수 있고, 함수가 먼저 '관리자인가?'를 확인합니다.
-- 제목(jobs)과 상세(job_details)를 한 번에 저장하므로, 한쪽만 저장되는 일이 없습니다.

create function public.admin_create_job(
  p_title          text,
  p_organization   text,
  p_region         text,
  p_deadline       date,
  p_schedule       text,
  p_description    text,
  p_target         text    default null,
  p_headcount      integer default null,
  p_qualifications text    default null,
  p_documents      text    default null,
  p_source_url     text    default null,
  p_apply_url      text    default null,
  p_apply_email    text    default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception '관리자만 공고를 올릴 수 있습니다.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_organization), '') = ''
     or coalesce(btrim(p_region), '') = '' or p_deadline is null
     or coalesce(btrim(p_schedule), '') = '' or coalesce(btrim(p_description), '') = '' then
    raise exception '꼭 적어야 하는 칸이 비어 있습니다.' using errcode = '22023';
  end if;

  -- 링크는 http:// 또는 https:// 로 시작하는 것만 받는다 (엉뚱한 링크가 버튼이 되지 않게).
  if nullif(btrim(p_source_url), '') !~* '^https?://' or nullif(btrim(p_apply_url), '') !~* '^https?://' then
    raise exception '링크는 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;

  insert into public.jobs (title) values (btrim(p_title)) returning id into new_id;

  insert into public.job_details (
    job_id, organization, region, deadline, schedule, description,
    target, headcount, qualifications, documents, source_url, apply_url, apply_email
  ) values (
    new_id, btrim(p_organization), btrim(p_region), p_deadline, btrim(p_schedule), btrim(p_description),
    nullif(btrim(p_target), ''), p_headcount, nullif(btrim(p_qualifications), ''),
    nullif(btrim(p_documents), ''), nullif(btrim(p_source_url), ''),
    nullif(btrim(p_apply_url), ''), nullif(btrim(p_apply_email), '')
  );

  return new_id;
end;
$$;

revoke execute on function public.admin_create_job(text, text, text, date, text, text, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_job(text, text, text, date, text, text, text, integer, text, text, text, text, text) to authenticated;

-- Supabase에게 새 함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- admin-job-edit.sql
-- ============================================================

-- 강사잇다 · 관리자 화면에서 공고 수정·숨기기
-- admins.sql, admin-job-create.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 새로 덮어씁니다).
--
-- 숨기기: 공고를 지우지 않고 사이트에서만 안 보이게 합니다. 언제든 다시 올릴 수 있습니다.
--   jobs 표에 숨긴 시각(hidden_at) 칸을 더합니다. 비어 있으면 보이는 공고, 시각이 적혀 있으면 숨긴 공고입니다.
--   숨긴 공고는 비회원·회원 누구에게도 나오지 않고, 관리자 화면에서만 보입니다.

-- 1) 숨긴 시각 칸
alter table public.jobs add column if not exists hidden_at timestamptz;
comment on column public.jobs.hidden_at is '숨긴 시각. 비어 있으면 사이트에 보이고, 적혀 있으면 관리자에게만 보인다.';

-- 2) 회원이 읽는 규칙: 숨긴 공고는 빼고. 관리자는 전부.
drop policy if exists "회원은 공고 제목을 읽는다" on public.jobs;
create policy "회원은 공고 제목을 읽는다"
  on public.jobs for select to authenticated
  using (hidden_at is null or (select public.is_admin()));

drop policy if exists "회원은 공고 상세를 읽는다" on public.job_details;
create policy "회원은 공고 상세를 읽는다"
  on public.job_details for select to authenticated
  using (
    exists (select 1 from public.jobs j where j.id = job_details.job_id and j.hidden_at is null)
    or (select public.is_admin())
  );

-- 3) 비회원용 함수들도 숨긴 공고는 빼고 (내용은 전과 같고 hidden_at is null 조건만 더함)
create or replace function public.open_job_titles(today date)
returns table (id bigint, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where d.deadline >= today and j.hidden_at is null
  order by d.deadline, j.id;
$$;

create or replace function public.job_title(job_id bigint)
returns table (id bigint, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where j.id = job_title.job_id and j.hidden_at is null;
$$;

create or replace function public.today_job_count(today date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where (j.created_at at time zone 'Asia/Seoul')::date = today_job_count.today
    and d.deadline >= today_job_count.today
    and j.hidden_at is null;
$$;

create or replace function public.today_job_titles(today date)
returns table (id bigint, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where (j.created_at at time zone 'Asia/Seoul')::date = today_job_titles.today
    and d.deadline >= today_job_titles.today
    and j.hidden_at is null
  order by d.deadline, j.id;
$$;

-- 4) 공고 고치기 (관리자만). 칸 규칙은 admin_create_job 과 같다. 상세가 아직 없는 공고면 새로 만든다.
create or replace function public.admin_update_job(
  p_id             bigint,
  p_title          text,
  p_organization   text,
  p_region         text,
  p_deadline       date,
  p_schedule       text,
  p_description    text,
  p_target         text    default null,
  p_headcount      integer default null,
  p_qualifications text    default null,
  p_documents      text    default null,
  p_source_url     text    default null,
  p_apply_url      text    default null,
  p_apply_email    text    default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 공고를 고칠 수 있습니다.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_organization), '') = ''
     or coalesce(btrim(p_region), '') = '' or p_deadline is null
     or coalesce(btrim(p_schedule), '') = '' or coalesce(btrim(p_description), '') = '' then
    raise exception '꼭 적어야 하는 칸이 비어 있습니다.' using errcode = '22023';
  end if;

  if nullif(btrim(p_source_url), '') !~* '^https?://' or nullif(btrim(p_apply_url), '') !~* '^https?://' then
    raise exception '링크는 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;

  update public.jobs set title = btrim(p_title) where id = p_id;
  if not found then
    raise exception '없는 공고입니다.' using errcode = 'P0002';
  end if;

  insert into public.job_details (
    job_id, organization, region, deadline, schedule, description,
    target, headcount, qualifications, documents, source_url, apply_url, apply_email
  ) values (
    p_id, btrim(p_organization), btrim(p_region), p_deadline, btrim(p_schedule), btrim(p_description),
    nullif(btrim(p_target), ''), p_headcount, nullif(btrim(p_qualifications), ''),
    nullif(btrim(p_documents), ''), nullif(btrim(p_source_url), ''),
    nullif(btrim(p_apply_url), ''), nullif(btrim(p_apply_email), '')
  )
  on conflict (job_id) do update set
    organization = excluded.organization, region = excluded.region, deadline = excluded.deadline,
    schedule = excluded.schedule, description = excluded.description, target = excluded.target,
    headcount = excluded.headcount, qualifications = excluded.qualifications, documents = excluded.documents,
    source_url = excluded.source_url, apply_url = excluded.apply_url, apply_email = excluded.apply_email;
end;
$$;

-- 5) 숨기기 / 다시 올리기 (관리자만)
create or replace function public.admin_set_job_hidden(p_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 공고를 숨길 수 있습니다.' using errcode = '42501';
  end if;

  update public.jobs
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end
  where id = p_id;
  if not found then
    raise exception '없는 공고입니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_job(bigint, text, text, text, date, text, text, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_job(bigint, text, text, text, date, text, text, text, integer, text, text, text, text, text) to authenticated;
revoke execute on function public.admin_set_job_hidden(bigint, boolean) from public, anon;
grant execute on function public.admin_set_job_hidden(bigint, boolean) to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- admin-requests.sql
-- ============================================================

-- 강사잇다 · 관리자 화면에서 강사섭외 의뢰 보기·처리 상태 바꾸기
-- admins.sql, instructor-requests.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 누릅니다.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 새로 덮어씁니다).
--
-- 의뢰에는 담당자 연락처(개인정보)가 들어 있으므로 관리자만 읽을 수 있습니다.
-- 일반 회원·비회원은 지금처럼 보내기만 되고 읽을 수 없습니다.

-- 1) 읽기: 관리자만 (일반 회원이 읽으면 0줄)
grant select on public.instructor_requests to authenticated;

drop policy if exists "관리자는 강사섭외 의뢰를 읽는다" on public.instructor_requests;
create policy "관리자는 강사섭외 의뢰를 읽는다"
  on public.instructor_requests for select to authenticated
  using ((select public.is_admin()));

-- 2) 처리 상태 바꾸기 (관리자만). 상태는 접수 / 처리 중 / 완료 셋 중 하나.
create or replace function public.admin_set_request_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 의뢰 상태를 바꿀 수 있습니다.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('접수', '처리 중', '완료') then
    raise exception '상태는 접수, 처리 중, 완료 중 하나여야 합니다.' using errcode = '22023';
  end if;

  update public.instructor_requests set status = p_status where id = p_id;
  if not found then
    raise exception '없는 의뢰입니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_set_request_status(bigint, text) from public, anon;
grant execute on function public.admin_set_request_status(bigint, text) to authenticated;

comment on column public.instructor_requests.status is '접수 / 처리 중 / 완료 — 관리자 화면(/admin/requests)에서 바꿈';

-- Supabase에게 바뀐 규칙·새 함수를 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- admin-members.sql
-- ============================================================

-- 강사잇다 · 관리자 화면에서 회원 목록 보기
-- admins.sql, members.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 누릅니다.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 새로 덮어씁니다).
--
-- 회원 정보(이름·연락처·이메일)는 개인정보이므로 관리자만 전체를 읽을 수 있습니다.
-- 일반 회원은 지금처럼 자기 정보만 읽습니다. 관리자 화면에서는 보기만 하고 고치지 않습니다.

drop policy if exists "관리자는 모든 회원 정보를 읽는다" on public.members;
create policy "관리자는 모든 회원 정보를 읽는다"
  on public.members for select to authenticated
  using ((select public.is_admin()));

-- Supabase에게 바뀐 규칙을 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- delete-account.sql
-- ============================================================

-- 강사잇다 · 회원 탈퇴
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 로그인한 회원이 '자기 계정'만 지울 수 있는 함수입니다. 다른 사람의 계정은 지울 수 없습니다.
-- 계정(auth.users)을 지우면 회원 정보(members)와 관리자 명단(admins)의 그 회원 줄도 함께 지워집니다.
-- 되돌릴 수 없습니다.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Supabase에게 새 함수가 생겼다고 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- today-deadline-count.sql
-- ============================================================

-- 강사잇다 · 오늘 마감인 공고 수 (홈 화면 주황 상자)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 한국 날짜로 오늘이 마감일인 공고의 **개수만** 돌려줍니다 (숨긴 공고는 빼고).
-- 비회원도 부를 수 있지만 공고 내용(기관·지역·마감일)은 전혀 내주지 않습니다.

create or replace function public.today_deadline_count(today date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where d.deadline = today_deadline_count.today
    and j.hidden_at is null;
$$;

revoke execute on function public.today_deadline_count(date) from public;
grant execute on function public.today_deadline_count(date) to anon, authenticated;

-- Supabase에게 새 함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- ============================================================
-- instructor-requests-change-2.sql
-- ============================================================

-- 강사잇다 · 강사섭외 의뢰 표 고치기 ② 회원만 의뢰를 보낸다
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 지금까지는 로그인하지 않은 사람(anon)도 의뢰를 보낼 수 있었습니다.
-- 이제는 로그인한 회원(authenticated)만 보낼 수 있습니다. 화면에서 막는 것과 별개로 데이터베이스에서도 막습니다.

drop policy if exists "누구나 강사섭외 의뢰를 보낸다" on public.instructor_requests;
drop policy if exists "회원만 강사섭외 의뢰를 보낸다" on public.instructor_requests;
create policy "회원만 강사섭외 의뢰를 보낸다"
  on public.instructor_requests for insert
  to authenticated
  with check (status = '접수');

revoke insert on public.instructor_requests from anon;

-- Supabase에게 바뀐 규칙을 알리기
notify pgrst, 'reload schema';

-- ============================================================
-- instructor-profiles.sql
-- ============================================================

-- 강사잇다 · 강사 프로필 (기관 의뢰가 오면 운영자가 골라 전달)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- - 전달에 동의한 회원만 프로필을 낸다. 회원 한 명당 한 줄.
-- - 내는 방법은 둘 중 하나: 강사잇다 양식으로 작성(method = 'form') 또는 파일 올리기(method = 'file').
-- - 파일은 공개되지 않는 저장소(instructor-profiles)에 '회원번호/파일' 로 둔다. 본인과 관리자만 읽는다.
-- - 회원 탈퇴하면 프로필 줄은 함께 지워진다 (파일은 사이트가 탈퇴할 때 지운다).

-- 1) 표 ------------------------------------------------------------------
create table if not exists public.instructor_profiles (
  member_id     uuid primary key references public.members (id) on delete cascade,
  consent_at    timestamptz not null default now(),   -- 기관 전달에 동의한 시각
  fields        text[] not null,                     -- 강의 분야 (아래 규칙 참고)
  regions       text[] not null,                     -- 활동 가능 지역 (아래 규칙 참고)
  method        text not null check (method in ('form', 'file')),
  career        text check (career is null or char_length(career) <= 2000),
  certificates  text check (certificates is null or char_length(certificates) <= 1000),
  intro         text check (intro is null or char_length(intro) <= 500),
  file_path     text,
  file_name     text check (file_name is null or char_length(file_name) <= 200),
  updated_at    timestamptz not null default now(),
  -- 양식이면 경력이, 파일이면 자기 폴더 안의 파일이 있어야 한다
  constraint instructor_profiles_content check (
    (method = 'form' and career is not null and char_length(trim(career)) > 0)
    or (method = 'file' and file_path is not null and file_path like member_id::text || '/%')
  )
);

-- 강의 분야: 정해진 목록에서 고른다 (lib/profile-schema.ts 의 PROFILE_FIELDS 와 같아야 한다).
-- 예전 판(글자로 적는 칸)을 이미 실행했다면 목록 방식으로 바꾼다. 그때 적어 둔 시험 값은 '기타'가 된다.
do $conv$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'instructor_profiles' and column_name = 'fields') = 'text' then
    alter table public.instructor_profiles drop constraint if exists instructor_profiles_fields_check;
    alter table public.instructor_profiles alter column fields type text[] using array['기타'];
  end if;
end
$conv$;
alter table public.instructor_profiles drop constraint if exists instructor_profiles_fields_check;
alter table public.instructor_profiles add constraint instructor_profiles_fields_check
  check (cardinality(fields) between 1 and 10
         and fields <@ array['진로·창업', '코딩·AI', '방과후(예체능)', '방과후(교과)', '독서·논술',
                             '리더십·소통', '직무·CS', '인문·교양', '힐링·건강', '기타']);

-- 활동 가능 지역: 권역 단위 (lib/profile-schema.ts 의 PROFILE_REGIONS 와 같아야 한다). 여러 번 실행해도 새 규칙으로 바뀐다.
alter table public.instructor_profiles drop constraint if exists instructor_profiles_regions_check;
alter table public.instructor_profiles add constraint instructor_profiles_regions_check
  check (cardinality(regions) between 1 and 7
         and regions <@ array['전국구', '경기권', '강원권', '충청권', '전라권', '경상권', '제주권']);

comment on table public.instructor_profiles is
  '강사 프로필. 기관 전달에 동의한 회원만. 운영자가 의뢰 기관에 골라 전달한다. 연락처는 섭외 확정 뒤에 알린다.';

-- 2) 누가 무엇을 할 수 있나 ------------------------------------------------
alter table public.instructor_profiles enable row level security;

drop policy if exists "회원은 자기 프로필을 읽는다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 읽는다"
  on public.instructor_profiles for select to authenticated
  using ((select auth.uid()) = member_id);

drop policy if exists "관리자는 모든 프로필을 읽는다" on public.instructor_profiles;
create policy "관리자는 모든 프로필을 읽는다"
  on public.instructor_profiles for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "회원은 자기 프로필을 낸다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 낸다"
  on public.instructor_profiles for insert to authenticated
  with check ((select auth.uid()) = member_id);

drop policy if exists "회원은 자기 프로필을 고친다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 고친다"
  on public.instructor_profiles for update to authenticated
  using ((select auth.uid()) = member_id)
  with check ((select auth.uid()) = member_id);

drop policy if exists "회원은 자기 프로필을 지운다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 지운다"
  on public.instructor_profiles for delete to authenticated
  using ((select auth.uid()) = member_id);

revoke all on public.instructor_profiles from anon, authenticated;
grant select, insert, update, delete on public.instructor_profiles to authenticated;

-- 3) 파일 저장소 (공개 안 함, 한 파일 10MB 까지) ------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('instructor-profiles', 'instructor-profiles', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "강사는 자기 프로필 파일을 올린다" on storage.objects;
create policy "강사는 자기 프로필 파일을 올린다"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "강사는 자기 프로필 파일을 읽는다" on storage.objects;
create policy "강사는 자기 프로필 파일을 읽는다"
  on storage.objects for select to authenticated
  using (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "강사는 자기 프로필 파일을 지운다" on storage.objects;
create policy "강사는 자기 프로필 파일을 지운다"
  on storage.objects for delete to authenticated
  using (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "관리자는 프로필 파일을 읽는다" on storage.objects;
create policy "관리자는 프로필 파일을 읽는다"
  on storage.objects for select to authenticated
  using (bucket_id = 'instructor-profiles' and (select public.is_admin()));

-- ============================================================
-- job-import.sql
-- ============================================================

-- 강사잇다 · 수집 프로그램이 공고를 바로 넣는 함수 (관리자 로그인 없이)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 매일 새벽 수집 프로그램(GitHub Actions)이 모은 공고를 사이트의 '받는 문'(/api/jobs/import)으로 보내면,
-- 사이트 서버가 이 함수로 공고를 저장합니다. 관리자 화면의 '엑셀로 올리기'와 같은 칸·같은 규칙입니다.
--
-- 누가 부를 수 있나: 사이트 서버(service_role)만. 회원·비회원(anon, authenticated)은 부를 수 없습니다.
-- 사이트 서버는 수집 프로그램이 보낸 비밀 열쇠(JOB_IMPORT_TOKEN)가 맞을 때만 이 함수를 부릅니다.
--
-- p_hidden 이 true 면 '숨김' 상태로 넣습니다 (관리자 화면에서 확인한 뒤 '다시 올리기'로 공개).
-- 기본은 false — 바로 사이트에 보입니다.

create or replace function public.import_job(
  p_title          text,
  p_organization   text,
  p_region         text,
  p_deadline       date,
  p_schedule       text,
  p_description    text,
  p_target         text    default null,
  p_headcount      integer default null,
  p_qualifications text    default null,
  p_documents      text    default null,
  p_source_url     text    default null,
  p_apply_url      text    default null,
  p_apply_email    text    default null,
  p_hidden         boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_organization), '') = ''
     or coalesce(btrim(p_region), '') = '' or p_deadline is null
     or coalesce(btrim(p_schedule), '') = '' or coalesce(btrim(p_description), '') = '' then
    raise exception '꼭 적어야 하는 칸이 비어 있습니다.' using errcode = '22023';
  end if;

  if nullif(btrim(p_source_url), '') !~* '^https?://' or nullif(btrim(p_apply_url), '') !~* '^https?://' then
    raise exception '링크는 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;

  -- 제목과 상세를 한 번에 저장한다 (한쪽만 저장되는 일이 없게)
  insert into public.jobs (title, hidden_at)
  values (btrim(p_title), case when p_hidden then now() else null end)
  returning id into new_id;

  insert into public.job_details (
    job_id, organization, region, deadline, schedule, description,
    target, headcount, qualifications, documents, source_url, apply_url, apply_email
  ) values (
    new_id, btrim(p_organization), btrim(p_region), p_deadline, btrim(p_schedule), btrim(p_description),
    nullif(btrim(p_target), ''), p_headcount, nullif(btrim(p_qualifications), ''),
    nullif(btrim(p_documents), ''), nullif(btrim(p_source_url), ''),
    nullif(btrim(p_apply_url), ''), nullif(btrim(p_apply_email), '')
  );

  return new_id;
end;
$$;

-- 사이트 서버(service_role)만 부를 수 있게. 회원·비회원은 못 부른다.
revoke execute on function public.import_job(text, text, text, date, text, text, text, integer, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.import_job(text, text, text, date, text, text, text, integer, text, text, text, text, text, boolean)
  to service_role;

-- ============================================================
-- job-region-group.sql
-- ============================================================

-- 강사잇다 · 비회원용 공고 목록 함수에 '권역' 한 칸 더하기 (지역 탭용)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 지금까지 비회원은 '번호·제목'만 받았습니다. 지역 탭(전체·부산·울산·경남)이 비회원에게도 동작하려면
-- 권역(지역 칸의 첫 단어: "부산 북구" → "부산")까지는 알려줘야 합니다. 구·군·기관·마감일은 여전히 내주지 않습니다.
--
-- 돌려주는 칸이 하나 늘어나므로 함수를 지우고 다시 만듭니다 (create or replace 로는 칸을 못 바꿈).

drop function if exists public.open_job_titles(date);

create function public.open_job_titles(today date)
returns table (id bigint, title text, region_group text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.title, split_part(btrim(d.region), ' ', 1) as region_group
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where d.deadline >= today and j.hidden_at is null
  order by d.deadline, j.id;
$$;

revoke execute on function public.open_job_titles(date) from public;
grant execute on function public.open_job_titles(date) to anon, authenticated;

-- ============================================================
-- kakao-notify.sql
-- ============================================================

-- 강사잇다 · 카톡 알림 연결 정보 (강사섭외 의뢰가 오면 운영자 카톡 '나와의 채팅'으로 알림)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 운영자가 관리자 화면(/admin/kakao)에서 '카카오 연결'을 누르면 카카오가 준 열쇠(토큰)를 이 표에 한 줄로 보관합니다.
-- 사이트 서버(service_role)만 읽고 씁니다. 회원·비회원·관리자 화면 모두 이 표를 직접 읽을 수 없습니다.

create table if not exists public.kakao_tokens (
  id                  integer primary key default 1 check (id = 1),  -- 항상 한 줄
  access_token        text not null,
  access_expires_at   timestamptz not null,      -- 보통 6시간 뒤
  refresh_token       text not null,
  refresh_expires_at  timestamptz not null,      -- 보통 2달 뒤. 지나면 관리자 화면에서 다시 연결
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_error          text                       -- 마지막으로 보내기 실패한 이유 (관리자 화면에 보여줌)
);

comment on table public.kakao_tokens is '카톡 알림(나에게 보내기) 연결 정보. 사이트 서버만 읽고 쓴다.';

alter table public.kakao_tokens enable row level security;
revoke all on public.kakao_tokens from public, anon, authenticated;
grant all on public.kakao_tokens to service_role;
-- 읽기 규칙(policy)을 하나도 만들지 않으므로 service_role 말고는 아무도 못 읽는다.

-- Supabase에게 새 표·규칙이 생겼다고 알리기
notify pgrst, 'reload schema';

commit;

-- 이 줄이 결과 칸에 보이면 설치가 끝난 것입니다.
select '설치 완료' as 결과;
