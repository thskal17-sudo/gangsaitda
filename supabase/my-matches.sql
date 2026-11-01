-- 강사잇다 · 강사 회원 '내 지원 현황' (내가 지원한 공고 + 운영자가 나를 추천한 의뢰)
-- job-apply.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다. 표는 바꾸지 않고, 읽기 함수 하나만 만듭니다.
--
-- - 강사는 추천 강사 표(request_matches)를 직접 읽지 못한다. 이 함수가 '로그인한 강사 본인 줄'만 골라
--   화면에 필요한 칸만 돌려준다.
-- - 운영자 추천은 운영자가 기관을 확인한 의뢰(org_verified_at)만 보인다. 기관이 추천 강사를 볼 수 있는 때와 같다.
-- - 기관 담당자의 이름·연락처·이메일, 예산(강사료), 기관이 남긴 요청 사항은 돌려주지 않는다.
--   추천받은 의뢰의 기관명은 '확정' 뒤에만 보인다 (그 전에는 기관 종류·지역만).
--   직접 지원한 공고는 공고에 이미 적힌 기관명을 그대로 쓴다.

create or replace function public.my_matches()
returns table (
  match_id       bigint,
  applied        boolean,       -- true: 내가 공고에서 직접 지원 / false: 운영자가 추천
  status         text,          -- 지원 · 추천 · 검토 중 · 연락 중 · 확정 · 불발
  started_at     timestamptz,   -- 지원한 시각, 또는 추천된 시각
  updated_at     timestamptz,   -- 상태가 마지막으로 바뀐 시각
  request_status text,          -- 의뢰 진행: 접수 · 처리 중 · 완료
  subject        text,          -- 필요한 분야·과목
  org_type       text,
  org_name       text,          -- 추천은 확정 뒤에만
  region         text,
  schedule       text,
  job_id         bigint,        -- 직접 지원한 공고 번호
  job_title      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         m.applied_at is not null,
         m.status,
         coalesce(m.applied_at, m.created_at),
         m.updated_at,
         r.status,
         r.subject,
         r.org_type,
         case when m.applied_at is not null then coalesce(d.organization, r.org_name)
              when m.status = '확정' then r.org_name end,
         coalesce(d.region, r.region),
         coalesce(d.schedule, r.schedule),
         j.id,
         j.title
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join lateral (
    select jj.id, jj.title from public.jobs jj
    where jj.request_id = m.request_id
    order by jj.id desc
    limit 1
  ) j on m.applied_at is not null
  left join public.job_details d on d.job_id = j.id
  where m.member_id = (select auth.uid())
    and (m.applied_at is not null or r.org_verified_at is not null)
  order by coalesce(m.applied_at, m.created_at) desc;
$$;
revoke execute on function public.my_matches() from public, anon;
grant execute on function public.my_matches() to authenticated;

-- Supabase에게 새 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '내 지원 현황 준비 완료' as 결과;
