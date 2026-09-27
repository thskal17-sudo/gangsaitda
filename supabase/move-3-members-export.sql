-- 강사잇다 · 회원 옮기기 ① 꺼내기  ── [옛 프로젝트 gangsaitda (싱가포르)] 에서 실행
-- 회원 계정(비밀번호 포함, 암호화된 상태 그대로)·회원 정보·관리자 명단을 글자 한 덩어리로 꺼냅니다.
-- 옮긴 뒤에는 예전 비밀번호로 새 사이트에 로그인할 수 있습니다.
--
-- 쓰는 법
--   1) 옛 프로젝트의 SQL Editor 에 붙여넣고 Run.  결과 칸에 영문·숫자로 된 긴 글자 한 칸이 나옵니다.
--   2) Export → Copy as JSON (또는 칸 내용을 복사) 해서, move-4-members-import.sql 의 표시된 줄에 붙여넣습니다.
-- 이 파일은 읽기만 하고 아무것도 바꾸지 않습니다.
-- ⚠ 결과에는 암호화된 비밀번호가 들어 있습니다. 채팅·메일 등 다른 곳에 붙여넣지 마세요.

select replace(encode(convert_to(jsonb_build_object(
  'users',      (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from auth.users u),
  'identities', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from auth.identities i),
  'members',    (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.members m),
  'admins',     (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.admins a)
)::text, 'UTF8'), 'base64'), E'\n', '') as 회원_옮길_데이터;
