-- 강사잇다 · [운영자용] 회원 비밀번호를 임시 비밀번호로 바꾸기
-- 비밀번호 찾기(메일)를 붙이기 전까지, 회원이 비밀번호를 잊었다고 문의하면 운영자가 씁니다.
--
-- 쓰는 법
--   1) 아래 두 곳을 고칩니다:  '회원이메일@example.com'  →  문의한 회원의 이메일
--                               '임시비밀번호123'         →  새 임시 비밀번호 (8자 이상)
--   2) Supabase SQL Editor 에 붙여넣고 Run.  결과에 1줄이 나오면 성공입니다 (0줄이면 이메일이 틀림).
--   3) 회원에게 임시 비밀번호를 알려 줍니다. (이 파일을 고친 채로 저장하거나 남에게 보내지 마세요)
--
-- ※ 문의한 사람이 정말 그 회원인지 먼저 확인하세요 (가입한 이름·연락처가 맞는지 등).

update auth.users
set encrypted_password = extensions.crypt('임시비밀번호123', extensions.gen_salt('bf')),
    updated_at = now()
where email = lower(btrim('회원이메일@example.com'))
returning email;
