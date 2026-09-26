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
