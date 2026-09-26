-- 강사잇다 · 강사섭외 의뢰 표 고치기 ① 담당자 이메일을 필수로
-- instructor-requests.sql 을 이미 실행한 경우에 SQL Editor 에서 한 번 실행합니다.
-- "contains null values" 오류가 나면: 이메일 없이 들어온 의뢰(시험 의뢰 등)가 있다는 뜻입니다.
-- Table Editor 에서 그 줄에 이메일을 적거나 지운 뒤 다시 실행하세요.

alter table public.instructor_requests
  alter column contact_email set not null,
  drop constraint if exists instructor_requests_contact_email_check,
  add constraint instructor_requests_contact_email_check
    check (char_length(contact_email) between 3 and 100 and contact_email like '%_@_%');
