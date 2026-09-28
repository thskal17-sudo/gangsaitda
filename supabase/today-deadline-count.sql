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

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '오늘 마감 공고 수 준비 완료' as 결과;
