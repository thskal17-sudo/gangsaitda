-- 강사잇다 · 강사섭외 의뢰 표 고치기 ② 회원만 의뢰를 보낸다
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 지금까지는 로그인하지 않은 사람(anon)도 의뢰를 보낼 수 있었습니다.
-- 이제는 로그인한 회원(authenticated)만 보낼 수 있습니다. 화면에서 막는 것과 별개로 데이터베이스에서도 막습니다.

drop policy if exists "누구나 강사섭외 의뢰를 보낸다" on public.instructor_requests;
drop policy if exists "회원만 강사섭외 의뢰를 보낸다" on public.instructor_requests;
create policy "회원만 강사섭외 의뢰를 보낸다"
  on public.instructor_requests for insert
  to authenticated
  with check (status = '접수');

revoke insert on public.instructor_requests from anon;

-- Supabase에게 바뀐 규칙을 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '회원만 의뢰 준비 완료' as 결과;
