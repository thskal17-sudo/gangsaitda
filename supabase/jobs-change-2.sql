-- 강사잇다 · 공고 표 고치기 ② 지원 방법(이메일·지원서 링크)을 선택 사항으로
-- jobs.sql 을 이미 실행한 경우에 한 번 실행합니다. 여러 번 실행해도 괜찮습니다.
-- 방문·우편 접수만 받는 공고도 올릴 수 있게 됩니다. 사이트는 "원문 공고에서 확인"으로 안내합니다.

alter table public.job_details drop constraint if exists job_details_apply_required;

comment on column public.job_details.apply_url is '지원서 링크 (없으면 비워 둠)';
comment on column public.job_details.apply_email is '지원 이메일 (방문·우편 접수만 받으면 비워 둠)';
