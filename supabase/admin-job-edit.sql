-- 강사잇다 · 관리자 화면에서 공고 수정·숨기기
-- admins.sql, admin-job-create.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.
--
-- 숨기기: 공고를 지우지 않고 사이트에서만 안 보이게 합니다. 언제든 다시 올릴 수 있습니다.
--   jobs 표에 '숨긴 시각(hidden_at)' 칸을 더합니다. 비어 있으면 보이는 공고, 시각이 적혀 있으면 숨긴 공고입니다.
--   숨긴 공고는 비회원·회원 누구에게도 나오지 않고, 관리자 화면에서만 보입니다.

-- 1) 숨긴 시각 칸
alter table public.jobs add column hidden_at timestamptz;
comment on column public.jobs.hidden_at is '숨긴 시각. 비어 있으면 사이트에 보이고, 적혀 있으면 관리자에게만 보인다.';

-- 2) 회원이 읽는 규칙: 숨긴 공고는 빼고. 관리자는 전부.
drop policy "회원은 공고 제목을 읽는다" on public.jobs;
create policy "회원은 공고 제목을 읽는다"
  on public.jobs for select to authenticated
  using (hidden_at is null or (select public.is_admin()));

drop policy "회원은 공고 상세를 읽는다" on public.job_details;
create policy "회원은 공고 상세를 읽는다"
  on public.job_details for select to authenticated
  using (
    exists (select 1 from public.jobs j where j.id = job_details.job_id and j.hidden_at is null)
    or (select public.is_admin())
  );

-- 3) 비회원용 함수들도 숨긴 공고는 빼고 (내용은 전과 같고 'hidden_at is null' 만 더함)
create or replace function public.open_job_titles(today date)
returns table (id bigint, title text)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where d.deadline >= today and j.hidden_at is null
  order by d.deadline, j.id;
$$;

create or replace function public.job_title(job_id bigint)
returns table (id bigint, title text)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where j.id = job_title.job_id and j.hidden_at is null;
$$;

create or replace function public.today_job_count(today date)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where (j.created_at at time zone 'Asia/Seoul')::date = today_job_count.today
    and d.deadline >= today_job_count.today
    and j.hidden_at is null;
$$;

create or replace function public.today_job_titles(today date)
returns table (id bigint, title text)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.title
  from public.jobs j
  join public.job_details d on d.job_id = j.id
  where (j.created_at at time zone 'Asia/Seoul')::date = today_job_titles.today
    and d.deadline >= today_job_titles.today
    and j.hidden_at is null
  order by d.deadline, j.id;
$$;

-- 4) 공고 고치기 (관리자만). 칸 규칙은 admin_create_job 과 같다. 상세가 아직 없는 공고면 새로 만든다.
create function public.admin_update_job(
  p_id             bigint,
  p_title          text,
  p_organization   text,
  p_region         text,
  p_deadline       date,
  p_schedule       text,
  p_description    text,
  p_target         text    default null,
  p_headcount      integer default null,
  p_qualifications text    default null,
  p_documents      text    default null,
  p_source_url     text    default null,
  p_apply_url      text    default null,
  p_apply_email    text    default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 공고를 고칠 수 있습니다.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_organization), '') = ''
     or coalesce(btrim(p_region), '') = '' or p_deadline is null
     or coalesce(btrim(p_schedule), '') = '' or coalesce(btrim(p_description), '') = '' then
    raise exception '꼭 적어야 하는 칸이 비어 있습니다.' using errcode = '22023';
  end if;

  if nullif(btrim(p_source_url), '') !~* '^https?://' or nullif(btrim(p_apply_url), '') !~* '^https?://' then
    raise exception '링크는 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;

  update public.jobs set title = btrim(p_title) where id = p_id;
  if not found then
    raise exception '없는 공고입니다.' using errcode = 'P0002';
  end if;

  insert into public.job_details (
    job_id, organization, region, deadline, schedule, description,
    target, headcount, qualifications, documents, source_url, apply_url, apply_email
  ) values (
    p_id, btrim(p_organization), btrim(p_region), p_deadline, btrim(p_schedule), btrim(p_description),
    nullif(btrim(p_target), ''), p_headcount, nullif(btrim(p_qualifications), ''),
    nullif(btrim(p_documents), ''), nullif(btrim(p_source_url), ''),
    nullif(btrim(p_apply_url), ''), nullif(btrim(p_apply_email), '')
  )
  on conflict (job_id) do update set
    organization = excluded.organization, region = excluded.region, deadline = excluded.deadline,
    schedule = excluded.schedule, description = excluded.description, target = excluded.target,
    headcount = excluded.headcount, qualifications = excluded.qualifications, documents = excluded.documents,
    source_url = excluded.source_url, apply_url = excluded.apply_url, apply_email = excluded.apply_email;
end;
$$;

-- 5) 숨기기 / 다시 올리기 (관리자만)
create function public.admin_set_job_hidden(p_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 공고를 숨길 수 있습니다.' using errcode = '42501';
  end if;

  update public.jobs
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end
  where id = p_id;
  if not found then
    raise exception '없는 공고입니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_job(bigint, text, text, text, date, text, text, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_job(bigint, text, text, text, date, text, text, text, integer, text, text, text, text, text) to authenticated;
revoke execute on function public.admin_set_job_hidden(bigint, boolean) from public, anon;
grant execute on function public.admin_set_job_hidden(bigint, boolean) to authenticated;

-- Supabase에게 바뀐 표·새 함수를 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';
