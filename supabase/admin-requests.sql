-- 강사잇다 · 관리자 화면에서 강사섭외 의뢰 보기·처리 상태 바꾸기
-- admins.sql, instructor-requests.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 누릅니다.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 새로 덮어씁니다).
--
-- 의뢰에는 담당자 연락처(개인정보)가 들어 있으므로 관리자만 읽을 수 있습니다.
-- 일반 회원·비회원은 지금처럼 보내기만 되고 읽을 수 없습니다.

-- 1) 읽기: 관리자만 (일반 회원이 읽으면 0줄)
grant select on public.instructor_requests to authenticated;

drop policy if exists "관리자는 강사섭외 의뢰를 읽는다" on public.instructor_requests;
create policy "관리자는 강사섭외 의뢰를 읽는다"
  on public.instructor_requests for select to authenticated
  using ((select public.is_admin()));

-- 2) 처리 상태 바꾸기 (관리자만). 상태는 접수 / 처리 중 / 완료 셋 중 하나.
create or replace function public.admin_set_request_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 의뢰 상태를 바꿀 수 있습니다.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('접수', '처리 중', '완료') then
    raise exception '상태는 접수, 처리 중, 완료 중 하나여야 합니다.' using errcode = '22023';
  end if;

  update public.instructor_requests set status = p_status where id = p_id;
  if not found then
    raise exception '없는 의뢰입니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_set_request_status(bigint, text) from public, anon;
grant execute on function public.admin_set_request_status(bigint, text) to authenticated;

comment on column public.instructor_requests.status is '접수 / 처리 중 / 완료 — 관리자 화면(/admin/requests)에서 바꿈';

-- Supabase에게 바뀐 규칙·새 함수를 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';
