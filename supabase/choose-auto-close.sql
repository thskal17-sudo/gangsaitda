-- 강사잇다 · 기관이 필요한 인원만큼 강사를 고르면 모집 공고를 자동으로 마감한다
-- request-postings.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 담당자가 [이 강사님으로 할게요]를 누를 때, 고른 강사 수가 의뢰서의 '필요한 강사 수'(비어 있으면 1명)에 닿으면
--   [모집 마감]을 누른 것과 똑같이 공고를 숨기고 마감 시각을 적는다 (숨긴 공고에는 지원할 수 없다).
-- - '불발'이 된 강사는 세지 않는다. 선택을 취소해도 공고를 다시 열지는 않는다 (필요하면 운영자가 다시 올린다).
-- - 함수가 '이번에 마감했는지'를 돌려주어, 화면이 "모집 공고를 마감했어요" 안내를 띄운다.

drop function if exists public.choose_match(bigint, boolean);
create function public.choose_match(p_match_id bigint, p_chosen boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request bigint;
  v_need integer;
  v_chosen integer;
  v_job bigint;
begin
  update public.request_matches m
  set org_chosen_at = case when p_chosen then coalesce(m.org_chosen_at, now()) else null end
  from public.instructor_requests r
  where m.id = p_match_id
    and r.id = m.request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
  returning r.id, r.headcount into v_request, v_need;
  if not found then
    raise exception '고를 수 없는 강사입니다.' using errcode = 'P0002';
  end if;
  if not p_chosen then
    return false;
  end if;

  select count(*) into v_chosen
  from public.request_matches m
  where m.request_id = v_request and m.org_chosen_at is not null and m.status <> '불발';
  if v_chosen < greatest(coalesce(v_need, 1), 1) then
    return false;
  end if;

  -- 올라가 있는(승인되고 아직 마감 안 한) 모집 공고가 있으면 마감
  select p.job_id into v_job
  from public.request_postings p
  where p.request_id = v_request and p.status = '승인' and p.closed_at is null;
  if v_job is null then
    return false;
  end if;
  update public.jobs set hidden_at = coalesce(hidden_at, now()) where id = v_job;
  update public.request_postings set closed_at = now() where request_id = v_request;
  return true;
end;
$$;
revoke execute on function public.choose_match(bigint, boolean) from public, anon;
grant execute on function public.choose_match(bigint, boolean) to authenticated;

-- Supabase에게 바뀐 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '강사 선택 시 자동 마감 준비 완료' as 결과;
