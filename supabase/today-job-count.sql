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
