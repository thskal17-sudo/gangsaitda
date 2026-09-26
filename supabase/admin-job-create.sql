-- 강사잇다 · 관리자 화면에서 공고 올리기
-- admins.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다.
-- 두 번 실행하면 "already exists" 오류가 납니다. 이미 만든 것이므로 괜찮습니다.
--
-- 공고 표(jobs, job_details)는 여전히 사이트에서 직접 고칠 수 없습니다.
-- 대신 이 함수 하나로만 공고를 올릴 수 있고, 함수가 먼저 '관리자인가?'를 확인합니다.
-- 제목(jobs)과 상세(job_details)를 한 번에 저장하므로, 한쪽만 저장되는 일이 없습니다.

create function public.admin_create_job(
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
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception '관리자만 공고를 올릴 수 있습니다.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_organization), '') = ''
     or coalesce(btrim(p_region), '') = '' or p_deadline is null
     or coalesce(btrim(p_schedule), '') = '' or coalesce(btrim(p_description), '') = '' then
    raise exception '꼭 적어야 하는 칸이 비어 있습니다.' using errcode = '22023';
  end if;

  -- 링크는 http:// 또는 https:// 로 시작하는 것만 받는다 (엉뚱한 링크가 버튼이 되지 않게).
  if nullif(btrim(p_source_url), '') !~* '^https?://' or nullif(btrim(p_apply_url), '') !~* '^https?://' then
    raise exception '링크는 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;

  insert into public.jobs (title) values (btrim(p_title)) returning id into new_id;

  insert into public.job_details (
    job_id, organization, region, deadline, schedule, description,
    target, headcount, qualifications, documents, source_url, apply_url, apply_email
  ) values (
    new_id, btrim(p_organization), btrim(p_region), p_deadline, btrim(p_schedule), btrim(p_description),
    nullif(btrim(p_target), ''), p_headcount, nullif(btrim(p_qualifications), ''),
    nullif(btrim(p_documents), ''), nullif(btrim(p_source_url), ''),
    nullif(btrim(p_apply_url), ''), nullif(btrim(p_apply_email), '')
  );

  return new_id;
end;
$$;

revoke execute on function public.admin_create_job(text, text, text, date, text, text, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_job(text, text, text, date, text, text, text, integer, text, text, text, text, text) to authenticated;

-- Supabase에게 새 함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';
