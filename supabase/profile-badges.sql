-- 강사잇다 · 강사 프로필 확인 배지 ('프로필 확인', '강의계획서 확인')
-- request-complete-hide.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 강사가 프로필에 '대표 강의계획서'(선택)를 함께 올릴 수 있다. 파일은 프로필 파일과 같은 저장소의 자기 폴더에 둔다.
-- - 운영자가 관리자 화면에서 내용을 보고 [확인]을 누르면 배지가 붙는다. 기관 담당자는 추천 강사 카드에서 배지를 본다.
-- - 확인한 뒤 강사가 내용(경력·자격·소개·프로필 파일)이나 강의계획서 파일을 바꾸면 배지는 저절로 내려간다.
--   운영자 화면에는 '다시 확인'으로 보인다. 같은 내용으로 다시 저장만 한 것은 그대로 둔다.
-- - 배지 기록은 관리자만 읽고 쓴다. 강사는 자기 프로필 표를 직접 고칠 수 있으므로 배지는 따로 둔다.

-- 1) 강사 프로필에 '대표 강의계획서' 칸 ------------------------------------------------------
alter table public.instructor_profiles add column if not exists sample_plan_path text;
alter table public.instructor_profiles add column if not exists sample_plan_name text;

alter table public.instructor_profiles drop constraint if exists instructor_profiles_sample_plan_check;
alter table public.instructor_profiles add constraint instructor_profiles_sample_plan_check
  check (
    (sample_plan_path is null and sample_plan_name is null)
    or (sample_plan_path like member_id::text || '/%'
        and sample_plan_name is not null and char_length(sample_plan_name) between 1 and 200)
  );

comment on column public.instructor_profiles.sample_plan_path is '강사가 올린 대표 강의계획서 (선택). 저장소 instructor-profiles 의 자기 폴더';

-- 2) 프로필 내용 지문: 확인한 뒤 내용이 바뀌었는지 알아보는 데 쓴다 -----------------------------------
--    분야·지역은 넣지 않는다 (운영자가 확인하는 것은 경력·자격·소개·파일 내용).
create or replace function public.profile_content_key(
  p_method text, p_career text, p_certificates text, p_intro text, p_file_path text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(concat_ws(chr(31), coalesce(p_method, ''), coalesce(p_career, ''), coalesce(p_certificates, ''),
                       coalesce(p_intro, ''), coalesce(p_file_path, '')));
$$;

-- 3) 배지 기록 (강사 한 명당 한 줄, 관리자만) ---------------------------------------------------
--    가입 강사는 member_id, 운영자 등록 강사는 instructor_id. 프로필이나 등록 강사를 지우면 함께 지워진다.
create table if not exists public.profile_checks (
  id                 bigint generated always as identity primary key,
  member_id          uuid unique references public.instructor_profiles (member_id) on delete cascade,
  instructor_id      uuid unique references public.admin_instructors (id) on delete cascade,
  profile_key        text,                -- 확인할 때의 프로필 내용 지문
  profile_checked_at timestamptz,
  profile_note       text check (profile_note is null or char_length(profile_note) <= 200),
  plan_path          text,                -- 확인할 때의 대표 강의계획서 파일 자리
  plan_checked_at    timestamptz,
  plan_note          text check (plan_note is null or char_length(plan_note) <= 200),
  constraint profile_checks_one_owner check ((member_id is null) <> (instructor_id is null))
);

comment on table public.profile_checks is
  '강사 프로필 확인 배지. 운영자가 확인한 때의 내용 지문을 적어 두고, 내용이 같을 때만 배지를 보여 준다. 관리자만 읽고 쓴다.';

alter table public.profile_checks enable row level security;

drop policy if exists "관리자는 배지 기록을 읽는다" on public.profile_checks;
create policy "관리자는 배지 기록을 읽는다"
  on public.profile_checks for select to authenticated
  using ((select public.is_admin()));

revoke all on public.profile_checks from anon, authenticated;
grant select on public.profile_checks to authenticated;
-- 쓰기는 아래 함수(admin_set_profile_check)로만 한다.

-- 4) 관리자: 확인 / 확인 취소 -----------------------------------------------------------------
--    p_kind: 'profile' = 프로필 확인, 'plan' = 강의계획서 확인 (가입 강사만, 대표 강의계획서가 있어야 한다)
create or replace function public.admin_set_profile_check(p_id uuid, p_kind text, p_checked boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_is_member boolean;
  v_key text;
  v_plan text;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  if p_kind not in ('profile', 'plan') then
    raise exception '확인 종류가 올바르지 않습니다' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception '메모는 200자까지 적을 수 있습니다' using errcode = '22023';
  end if;

  select true, public.profile_content_key(p.method, p.career, p.certificates, p.intro, p.file_path), p.sample_plan_path
    into v_is_member, v_key, v_plan
  from public.instructor_profiles p where p.member_id = p_id;

  if v_is_member is null then
    select false, public.profile_content_key('file', null, null, null, ai.file_path)
      into v_is_member, v_key
    from public.admin_instructors ai where ai.id = p_id;
  end if;
  if v_is_member is null then
    raise exception '강사를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_kind = 'plan' and p_checked and v_plan is null then
    raise exception '대표 강의계획서가 없습니다' using errcode = '22023';
  end if;

  -- 줄이 없으면 만든다
  if v_is_member then
    insert into public.profile_checks (member_id) values (p_id) on conflict (member_id) do nothing;
  else
    insert into public.profile_checks (instructor_id) values (p_id) on conflict (instructor_id) do nothing;
  end if;

  if p_kind = 'profile' then
    update public.profile_checks set
      profile_key        = case when p_checked then v_key end,
      profile_checked_at = case when p_checked then now() end,
      profile_note       = case when p_checked then v_note end
    where member_id = p_id or instructor_id = p_id;
  else
    update public.profile_checks set
      plan_path       = case when p_checked then v_plan end,
      plan_checked_at = case when p_checked then now() end,
      plan_note       = case when p_checked then v_note end
    where member_id = p_id or instructor_id = p_id;
  end if;
end;
$$;
revoke execute on function public.admin_set_profile_check(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_set_profile_check(uuid, text, boolean, text) to authenticated;

-- 5) 관리자: 강사별 배지 상태 ('확인' = 배지 붙음, '다시 확인' = 확인한 뒤 내용이 바뀜) -------------------
create or replace function public.admin_profile_checks()
returns table (
  id uuid,
  profile_status text, profile_checked_at timestamptz, profile_note text,
  plan_status text, plan_checked_at timestamptz, plan_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.member_id, c.instructor_id),
         case when c.profile_key is null then null
              when c.profile_key = case when c.member_id is not null
                                        then public.profile_content_key(p.method, p.career, p.certificates, p.intro, p.file_path)
                                        else public.profile_content_key('file', null, null, null, ai.file_path) end
              then '확인' else '다시 확인' end,
         c.profile_checked_at, c.profile_note,
         case when c.plan_path is null then null
              when c.plan_path = p.sample_plan_path then '확인' else '다시 확인' end,
         c.plan_checked_at, c.plan_note
  from public.profile_checks c
  left join public.instructor_profiles p on p.member_id = c.member_id
  left join public.admin_instructors ai on ai.id = c.instructor_id
  where (select public.is_admin());
$$;
revoke execute on function public.admin_profile_checks() from public, anon;
grant execute on function public.admin_profile_checks() to authenticated;

-- 6) 강사: 내 배지 상태 (내 프로필 화면) ---------------------------------------------------------
create or replace function public.my_profile_checks()
returns table (profile_status text, plan_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.profile_key is null then null
              when c.profile_key = public.profile_content_key(p.method, p.career, p.certificates, p.intro, p.file_path)
              then '확인' else '다시 확인' end,
         case when c.plan_path is null then null
              when c.plan_path = p.sample_plan_path then '확인' else '다시 확인' end
  from public.profile_checks c
  join public.instructor_profiles p on p.member_id = c.member_id
  where c.member_id = (select auth.uid());
$$;
revoke execute on function public.my_profile_checks() from public, anon;
grant execute on function public.my_profile_checks() to authenticated;

-- 7) 담당자 함수: 추천 강사에 배지 두 칸(profile_checked, plan_checked)을 더한다 ----------------------
--    request-complete-hide.sql 의 함수와 같고, 맨 끝 두 칸만 늘었다.
drop function if exists public.my_request_matches(bigint);
create function public.my_request_matches(p_request_id bigint)
returns table (
  match_id bigint, status text, chosen boolean,
  name text, fields text[], regions text[], method text,
  career text, certificates text, intro text,
  file_name text, has_file boolean, plan_name text, has_plan boolean,
  phone text, email text,
  applied boolean, apply_message text,
  profile_checked boolean, plan_checked boolean
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
         m.applied_at is not null, m.apply_message,
         coalesce(c.profile_key = case when p.member_id is not null
                                       then public.profile_content_key(p.method, p.career, p.certificates, p.intro, p.file_path)
                                       else public.profile_content_key('file', null, null, null, ai.file_path) end, false),
         coalesce(c.plan_path is not null and c.plan_path = p.sample_plan_path, false)
  from public.request_matches m
  join public.instructor_requests r on r.id = m.request_id
  left join public.instructor_profiles p on p.member_id = m.member_id
  left join public.members mb on mb.id = m.member_id
  left join public.admin_instructors ai on ai.id = m.instructor_id
  left join public.profile_checks c on c.member_id = p.member_id or c.instructor_id = ai.id
  where m.request_id = p_request_id
    and r.requester_id = (select auth.uid())
    and r.org_verified_at is not null
    and r.status <> '완료'
    and (p.member_id is not null or ai.id is not null or m.applied_at is not null)
  order by m.id;
$$;
revoke execute on function public.my_request_matches(bigint) from public, anon;
grant execute on function public.my_request_matches(bigint) to authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '프로필 확인 배지 준비 완료' as 결과;
