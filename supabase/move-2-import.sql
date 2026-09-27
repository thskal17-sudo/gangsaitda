-- 강사잇다 · 데이터 옮기기 ② 넣기  ── [새 프로젝트(서울)] 에서 실행
-- setup-all.sql 을 먼저 실행한 뒤 씁니다. move-1-export.sql 로 꺼낸 내용을 넣습니다.
--
-- 쓰는 법
--   1) 아래 [[여기를 지우고 붙여넣기]] 한 줄을 지우고, 꺼낸 내용을 그 자리에 붙여넣습니다.
--      ($data$ 로 끝나는 줄과 $data$ 로 시작하는 줄은 지우지 마세요.)
--   2) 새 프로젝트의 SQL Editor 에서 Run.  맨 아래에 옮긴 개수가 나오면 성공입니다.
-- 전체가 명령 하나라서, 하나라도 오류가 나면 아무것도 들어가지 않습니다. 한 번만 실행하세요.

do $move$
declare
  t text := btrim($data$
[[여기를 지우고 붙여넣기]]
$data$, E' \n\r\t');
  v jsonb;
  found_it boolean := false;
begin
  -- 1) 붙여넣은 내용을 알아본다. 어떤 방식으로 복사했든(칸 복사, Copy as JSON, [[ ]] 괄호가 남은 경우)
  --    겉을 한 겹씩 벗겨 jobs·job_details·instructor_requests 가 든 덩어리를 찾는다.
  begin
    v := t::jsonb;
  exception when others then
    raise exception '붙여넣은 내용이 잘렸거나 아직 붙여넣지 않았습니다. move-1-export.sql 결과를 처음부터 끝까지 붙여넣어 주세요.';
  end;

  for i in 1..6 loop
    if jsonb_typeof(v) = 'object' and v ? 'jobs' and v ? 'job_details' and v ? 'instructor_requests' then
      found_it := true;
      exit;
    elsif jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 0 then
      v := v -> 0;                                        -- [ ... ] 벗기기
    elsif jsonb_typeof(v) = 'object' and (select count(*) from jsonb_object_keys(v)) = 1 then
      v := (select value from jsonb_each(v));             -- {"옮길_데이터": ...} 벗기기
    elsif jsonb_typeof(v) = 'string' then
      begin
        v := (v #>> '{}')::jsonb;                         -- "{...}" 글자를 JSON 으로
      exception when others then
        exit;
      end;
    else
      exit;
    end if;
  end loop;

  if not found_it then
    raise exception '붙여넣은 내용을 알아볼 수 없습니다. move-1-export.sql 결과를 빠짐없이 붙여넣었는지 확인해 주세요.';
  end if;

  -- 2) 번호 그대로 넣기
  insert into public.jobs (id, title, created_at, hidden_at) overriding system value
  select id, title, created_at, hidden_at
  from jsonb_populate_recordset(null::public.jobs, v -> 'jobs');

  insert into public.job_details
  select * from jsonb_populate_recordset(null::public.job_details, v -> 'job_details');

  insert into public.instructor_requests overriding system value
  select * from jsonb_populate_recordset(null::public.instructor_requests, v -> 'instructor_requests');

  -- 3) 새로 올리는 공고·의뢰 번호가 옮긴 번호 다음부터 이어지게
  perform setval(pg_get_serial_sequence('public.jobs', 'id'), coalesce((select max(id) from public.jobs), 0) + 1, false);
  perform setval(pg_get_serial_sequence('public.instructor_requests', 'id'), coalesce((select max(id) from public.instructor_requests), 0) + 1, false);
end
$move$;

select
  (select count(*) from public.jobs)                             as 옮긴_공고,
  (select count(*) from public.job_details)                      as 옮긴_공고_상세,
  (select count(*) from public.jobs where hidden_at is not null) as 그중_숨긴_공고,
  (select count(*) from public.instructor_requests)              as 옮긴_의뢰;
