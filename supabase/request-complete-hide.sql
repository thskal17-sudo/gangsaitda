-- 강사잇다 · 완료된 의뢰에서는 기관 화면에 강사 프로필·파일·연락처를 가린다
-- job-apply.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- 개인정보 안내대로 강사 정보는 "기관의 섭외 검토가 끝날 때까지"만 전달한다.
-- 운영자가 의뢰를 '완료'로 바꾸면 담당자 함수(my_request_matches, my_match_file)가 아무것도 돌려주지 않는다.
-- 다시 '처리 중'으로 되돌리면 다시 보인다. 운영자(관리자 화면)에는 그대로 보인다.

-- 1) 담당자 함수: 의뢰가 '완료'되면 강사 목록·파일을 더 이상 돌려주지 않는다 ---------------------
drop function if exists public.my_request_matches(bigint);
create function public.my_request_matches(p_request_id bigint)
returns table (
  match_id bigint, status text, chosen boolean,
  name text, fields text[], regions text[], method text,
  career text, certificates text, intro text,
  file_name text, has_file boolean, plan_name text, has_plan boolean,
  phone text, email text,
  applied boolean, apply_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.status, m.org_chosen_at is not null,
         coalesce(mb.name, ai.name),
         coalesce(p.fields, ai.fields, '{}'::text[]), coalesce(p.regions, ai.regions, '{}'::text[]),
         coalesce(p.method, 'file'),
         p.career, p.certificates, p.intro,
         coalesce(p.file_name, m.apply_profile_name, ai.file_name),
         case when m.member_id is not null then ((p.method = 'file' and p.file_path is not null) or m.apply_profile_path is not null)
              else ai.file_path is not null end,
         m.plan_name, m.plan_path is not null,
         case when m.status = '확정' then coalesce(mb.phone, ai.phone) end,
         case when m.status = '확정' then coalesce(mb.email, ai.email) end,
         m.applied_at is not null, m.apply_message
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and r.status <> '완료'
    and (p.member_id is not null or ai.id is not null or m.applied_at is not null)
  order by m.id;
$$;
revoke execute on function public.my_request_matches(bigint) from public, anon;
grant execute on function public.my_request_matches(bigint) to authenticated;

drop function if exists public.my_match_file(bigint, text);
create function public.my_match_file(p_match_id bigint, p_kind text)
returns table (bucket text, path text, file_name text, instructor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_kind = 'plan' then 'request-files'
              when p.file_path is not null then 'instructor-profiles'
              when m.apply_profile_path is not null then 'request-files'
              else 'instructor-profiles' end,
         case when p_kind = 'plan' then m.plan_path else coalesce(p.file_path, m.apply_profile_path, ai.file_path) end,
         case when p_kind = 'plan' then m.plan_name else coalesce(p.file_name, m.apply_profile_name, ai.file_name) end,
         coalesce(mb.name, ai.name)
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  where m.id = p_match_id
    and p_kind in ('plan', 'profile')
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and r.status <> '완료'
    and (case when p_kind = 'plan' then m.plan_path else coalesce(p.file_path, m.apply_profile_path, ai.file_path) end) is not null;
$$;
revoke execute on function public.my_match_file(bigint, text) from public, anon;
grant execute on function public.my_match_file(bigint, text) to authenticated;

-- Supabase에게 바뀐 함수를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '완료 의뢰 프로필 가리기 준비 완료' as 결과;
