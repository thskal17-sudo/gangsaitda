-- 강사잇다 · 공고 표 고치기 ① 강사료·전화번호 칸 없애기
-- jobs.sql 을 **이미 실행한 경우에만** SQL Editor 에서 한 번 실행합니다.
-- (jobs.sql 을 아직 실행하지 않았다면 이 파일은 필요 없습니다. 새 jobs.sql 에 이미 반영되어 있습니다.)
-- 두 칸에 적어 둔 내용이 있었다면 함께 지워집니다.
-- "violates check constraint" 오류가 나면: 전화번호만 적힌 공고가 있다는 뜻입니다.
-- 그 공고에 지원 이메일(apply_email)이나 지원서 링크(apply_url)를 먼저 적고 다시 실행하세요.

alter table public.job_details
  drop constraint job_details_apply_required,
  drop column pay,
  drop column apply_phone;

-- 지원 방법(지원서 링크·이메일)은 하나 이상 적어야 한다.
alter table public.job_details
  add constraint job_details_apply_required check (
    coalesce(nullif(btrim(apply_url), ''), nullif(btrim(apply_email), '')) is not null
  );

comment on column public.job_details.apply_url is '지원서 링크. 지원서 링크·이메일 중 하나 이상 필수';
comment on column public.job_details.apply_email is '지원 이메일. 지원서 링크·이메일 중 하나 이상 필수';
