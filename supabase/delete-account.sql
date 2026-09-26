-- 강사잇다 · 회원 탈퇴
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 로그인한 회원이 '자기 계정'만 지울 수 있는 함수입니다. 다른 사람의 계정은 지울 수 없습니다.
-- 계정(auth.users)을 지우면 회원 정보(members)와 관리자 명단(admins)의 그 회원 줄도 함께 지워집니다.
-- 되돌릴 수 없습니다.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Supabase에게 새 함수가 생겼다고 알리기 (이게 없으면 schema cache 오류가 날 수 있음)
notify pgrst, 'reload schema';
