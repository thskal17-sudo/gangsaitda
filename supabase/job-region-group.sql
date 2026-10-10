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

-- Supabase에게 바뀐 함수를 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '지역 탭 준비 완료' as 결과;
