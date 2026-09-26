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
