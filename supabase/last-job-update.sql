-- 강사잇다 · 마지막으로 공고를 올린 시각 (홈 화면 "오늘 오전 9:12 업데이트")
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 숨기지 않은 공고 중 가장 최근에 올린 시각 하나만 돌려줍니다. 공고 내용은 내주지 않습니다.

create or replace function public.last_job_update()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(created_at) from public.jobs where hidden_at is null;
$$;

revoke execute on function public.last_job_update() from public;
grant execute on function public.last_job_update() to anon, authenticated;

notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '업데이트 시각 준비 완료' as 결과;
