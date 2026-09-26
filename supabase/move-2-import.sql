-- 강사잇다 · 데이터 옮기기 ② 넣기  ── [새 프로젝트(서울)] 에서 실행
-- setup-all.sql 을 먼저 실행한 뒤 씁니다. move-1-export.sql 로 꺼낸 내용을 넣습니다.
--
-- 쓰는 법
--   1) 아래 [[여기를 지우고 붙여넣기]] 한 줄을 지우고, 꺼낸 내용을 그 자리에 붙여넣습니다.
--      ($data$ 로 시작하는 줄과 $data$) 로 끝나는 줄은 지우지 마세요.)
--   2) 새 프로젝트의 SQL Editor 에서 Run.  맨 아래에 옮긴 개수가 나오면 성공입니다.
-- 하나라도 오류가 나면 아무것도 들어가지 않습니다 (전부 되돌림). 한 번만 실행하세요.

begin;

create temp table src on commit drop as
with pasted as (select btrim($data$
[[여기를 지우고 붙여넣기]]
$data$, E' \n\r\t') as t)
select case
         -- 'Copy as JSON' 으로 복사한 경우: [{"옮길_데이터": "..."}]
         when left(t, 1) = '[' then (select value::jsonb from jsonb_each_text((t::jsonb) -> 0) limit 1)
         -- 칸 내용을 그대로 복사한 경우: {"jobs": [...], ...}
         else t::jsonb
       end as d
from pasted;

-- 붙여넣은 내용이 알맞은지 확인 (아니면 여기서 멈추고 아무것도 넣지 않음)
do $check$
begin
  if not exists (select 1 from src where jsonb_typeof(d) = 'object' and d ? 'jobs' and d ? 'job_details' and d ? 'instructor_requests') then
    raise exception '붙여넣은 내용을 알아볼 수 없습니다. move-1-export.sql 결과를 빠짐없이 붙여넣었는지 확인해 주세요.';
  end if;
end
$check$;

insert into public.jobs (id, title, created_at, hidden_at) overriding system value
select id, title, created_at, hidden_at
from jsonb_populate_recordset(null::public.jobs, (select d -> 'jobs' from src));

insert into public.job_details
select * from jsonb_populate_recordset(null::public.job_details, (select d -> 'job_details' from src));

insert into public.instructor_requests overriding system value
select * from jsonb_populate_recordset(null::public.instructor_requests, (select d -> 'instructor_requests' from src));

-- 새로 올리는 공고·의뢰 번호가 옮긴 번호 다음부터 이어지게
select setval(pg_get_serial_sequence('public.jobs', 'id'), coalesce((select max(id) from public.jobs), 0) + 1, false);
select setval(pg_get_serial_sequence('public.instructor_requests', 'id'), coalesce((select max(id) from public.instructor_requests), 0) + 1, false);

commit;

select
  (select count(*) from public.jobs)                as 옮긴_공고,
  (select count(*) from public.job_details)         as 옮긴_공고_상세,
  (select count(*) from public.jobs where hidden_at is not null) as 그중_숨긴_공고,
  (select count(*) from public.instructor_requests) as 옮긴_의뢰;
