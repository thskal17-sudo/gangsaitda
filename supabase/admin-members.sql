-- 강사잇다 · 관리자 화면에서 회원 목록 보기
-- admins.sql, members.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 누릅니다.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 새로 덮어씁니다).
--
-- 회원 정보(이름·연락처·이메일)는 개인정보이므로 관리자만 전체를 읽을 수 있습니다.
-- 일반 회원은 지금처럼 자기 정보만 읽습니다. 관리자 화면에서는 보기만 하고 고치지 않습니다.

drop policy if exists "관리자는 모든 회원 정보를 읽는다" on public.members;
create policy "관리자는 모든 회원 정보를 읽는다"
  on public.members for select to authenticated
  using ((select public.is_admin()));

-- Supabase에게 바뀐 규칙을 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';
