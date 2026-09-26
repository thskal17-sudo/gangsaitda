-- 강사잇다 · [운영자용] 관리자로 지정하기
-- admins.sql 을 먼저 실행한 뒤 씁니다. 사이트에 먼저 회원가입한 계정이어야 합니다.
--
-- 쓰는 법
--   1) 아래 '관리자이메일@example.com' 을 관리자로 쓸 회원의 이메일로 고칩니다.
--   2) SQL Editor 에 붙여넣고 Run.  결과에 이메일 1줄이 나오면 성공입니다.
--      0줄이면: 이메일이 틀렸거나, 아직 가입 전이거나, 이미 관리자입니다.
--
-- 관리자에서 빼려면:  delete from public.admins where user_id = (select id from auth.users where email = '이메일');

insert into public.admins (user_id)
select id from auth.users where email = lower(btrim('관리자이메일@example.com'))
on conflict (user_id) do nothing
returning (select email from auth.users u where u.id = admins.user_id);
