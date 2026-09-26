-- 강사잇다 · 이메일(아이디) 찾기
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 이름과 연락처가 모두 맞는 회원의 이메일을 **가려서** 돌려줍니다. 예) abcd@naver.com → ab***@naver.com
-- 가리는 일은 데이터베이스 안에서 하므로, 전체 이메일은 밖으로 나가지 않습니다.

create or replace function public.find_member_email(member_name text, member_phone text)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when length(split_part(m.email, '@', 1)) <= 2
        then left(m.email, 1) || '***@' || split_part(m.email, '@', 2)
      else left(m.email, 2) || '***@' || split_part(m.email, '@', 2)
    end
  from public.members m
  where m.name = btrim(find_member_email.member_name)
    and m.phone = regexp_replace(coalesce(find_member_email.member_phone, ''), '\D', '', 'g')
    and btrim(coalesce(find_member_email.member_name, '')) <> ''
  order by m.created_at;
$$;

revoke execute on function public.find_member_email(text, text) from public;
grant execute on function public.find_member_email(text, text) to anon, authenticated;
