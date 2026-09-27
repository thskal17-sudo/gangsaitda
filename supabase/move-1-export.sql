-- 강사잇다 · 데이터 옮기기 ① 꺼내기  ── [옛 프로젝트(싱가포르)] 에서 실행
-- 공고(jobs, job_details)와 강사섭외 의뢰(instructor_requests)를 글자 한 덩어리로 꺼냅니다.
-- 회원은 옮기지 않습니다 (새 프로젝트에서 다시 가입).
--
-- 쓰는 법
--   1) 옛 프로젝트의 SQL Editor 에 붙여넣고 Run.  결과 칸에 '옮길_데이터' 한 칸이 나옵니다.
--   2) 결과 칸 오른쪽 위 Export → Copy as JSON  (또는 칸을 눌러 내용을 전부 복사)
--   3) move-2-import.sql 의 [[여기를 지우고 붙여넣기]] 줄을 지우고 그 자리에 붙여넣습니다.
-- 이 파일은 읽기만 하고 아무것도 바꾸지 않습니다.

select jsonb_build_object(
  'jobs',                (select coalesce(jsonb_agg(to_jsonb(j) order by j.id), '[]'::jsonb) from public.jobs j),
  'job_details',         (select coalesce(jsonb_agg(to_jsonb(d) order by d.job_id), '[]'::jsonb) from public.job_details d),
  'instructor_requests', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.instructor_requests r)
)::text as 옮길_데이터;
