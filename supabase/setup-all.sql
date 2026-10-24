-- 강사잇다 · 새 Supabase 프로젝트 한 번에 설치하기 (전체 표·규칙·함수)
-- 빈 새 프로젝트의 SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다. 결과에 Success 가 나오면 끝입니다.
-- 중간에 하나라도 오류가 나면 아무것도 만들어지지 않습니다 (전부 되돌림). 오류 문구를 그대로 알려 주세요.
--
-- 아래 파일들을 순서대로 이어 붙인 것입니다. 각 파일을 따로 실행할 필요는 없습니다.
--   members.sql, jobs.sql, find-email.sql, instructor-requests.sql, instructor-requests-change-1.sql, today-job-count.sql, today-job-titles.sql, admins.sql, admin-job-create.sql, admin-job-edit.sql, admin-requests.sql, admin-members.sql, delete-account.sql, today-deadline-count.sql, instructor-requests-change-2.sql, instructor-profiles.sql, job-import.sql, job-region-group.sql, kakao-notify.sql, request-matching.sql, request-portal.sql, admin-instructors.sql, member-type.sql, sms-consent.sql, request-postings.sql, job-apply.sql, request-feedback.sql
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
-- ============================================================
-- request-matching.sql
-- ============================================================

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


-- ============================================================
-- request-portal.sql
-- ============================================================

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


-- ============================================================
-- admin-instructors.sql
-- ============================================================

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

-- ============================================================
-- member-type.sql
-- ============================================================

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

-- ============================================================
-- sms-consent.sql
-- ============================================================

-- 강사잇다 · 교육·강의 섭외 소식 문자 수신 동의 (선택)
-- member-type.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 가입할 때 [선택] 문자 수신 동의를 체크할 수 있다 (체크하지 않아도 가입된다).
-- - 회원은 '문자 수신 설정'(/account/sms) 화면에서 언제든 켜고 끈다 (이 파일의 set_my_sms_consent).
-- - 문자는 동의한 회원(sms_agreed_at 이 비어 있지 않음)에게만 보낸다. 이미 가입한 회원은 모두 '동의 안 함'으로 시작한다.

-- 1) 회원 표에 칸 더하기 ----------------------------------------------------------------
alter table public.members add column if not exists sms_agreed_at  timestamptz; -- 동의한 시각. 비어 있으면 동의 안 함
alter table public.members add column if not exists sms_updated_at timestamptz; -- 마지막으로 동의·거부를 처리한 시각

comment on column public.members.sms_agreed_at is '교육·강의 섭외 소식 문자(광고성 정보) 수신 동의 시각. null 이면 동의 안 함';
comment on column public.members.sms_updated_at is '문자 수신 동의·거부를 마지막으로 처리한 시각';

-- 2) 가입하면 자동으로 회원 정보 만들기: 문자 수신 동의도 함께 ----------------------------
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
  member_sms   boolean := coalesce(new.raw_user_meta_data ->> 'sms_agreed', '') = 'true';
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

  insert into public.members (id, name, phone, email, privacy_agreed_at, member_type, org_name, sms_agreed_at, sms_updated_at)
  values (new.id, member_name, member_phone, new.email, now(), member_kind,
          case when member_kind = '기관' then left(member_org, 50) end,
          case when member_sms then now() end,
          now());
  return new;
end;
$$;

revoke execute on function public.handle_new_member() from public, anon, authenticated;

-- 3) 회원 본인: 문자 수신 켜기·끄기 -------------------------------------------------------
-- 회원은 회원 표를 직접 고칠 수 없어서(등급·종류 보호) 이 함수로만 바꾼다. 처리한 시각을 돌려준다.
create or replace function public.set_my_sms_consent(p_agreed boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  done_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다';
  end if;
  update public.members
  set sms_agreed_at  = case when p_agreed then done_at end,
      sms_updated_at = done_at
  where id = (select auth.uid());
  if not found then
    raise exception '회원 정보가 없습니다';
  end if;
  return done_at;
end;
$$;

revoke execute on function public.set_my_sms_consent(boolean) from public, anon;
grant execute on function public.set_my_sms_consent(boolean) to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기
notify pgrst, 'reload schema';

-- ============================================================
-- request-postings.sql
-- ============================================================

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

-- ============================================================
-- job-apply.sql
-- ============================================================

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

-- ============================================================
-- request-feedback.sql
-- ============================================================

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


select '설치 완료' as 결과;
