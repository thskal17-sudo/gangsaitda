-- 강사잇다 · 수집 프로그램이 공고를 바로 넣는 함수 (관리자 로그인 없이)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 매일 새벽 수집 프로그램(GitHub Actions)이 모은 공고를 사이트의 '받는 문'(/api/jobs/import)으로 보내면,
-- 사이트 서버가 이 함수로 공고를 저장합니다. 관리자 화면의 '엑셀로 올리기'와 같은 칸·같은 규칙입니다.
--
-- 누가 부를 수 있나: 사이트 서버(service_role)만. 회원·비회원(anon, authenticated)은 부를 수 없습니다.
-- 사이트 서버는 수집 프로그램이 보낸 비밀 열쇠(JOB_IMPORT_TOKEN)가 맞을 때만 이 함수를 부릅니다.
--
-- p_hidden 이 true 면 '숨김' 상태로 넣습니다 (관리자 화면에서 확인한 뒤 '다시 올리기'로 공개).
-- 기본은 false — 바로 사이트에 보입니다.

create or replace function public.import_job(
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
  p_apply_email    text    default null,
  p_hidden         boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_organization), '') = ''
     or coalesce(btrim(p_region), '') = '' or p_deadline is null
     or coalesce(btrim(p_schedule), '') = '' or coalesce(btrim(p_description), '') = '' then
    raise exception '꼭 적어야 하는 칸이 비어 있습니다.' using errcode = '22023';
  end if;

  if nullif(btrim(p_source_url), '') !~* '^https?://' or nullif(btrim(p_apply_url), '') !~* '^https?://' then
    raise exception '링크는 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;

  -- 제목과 상세를 한 번에 저장한다 (한쪽만 저장되는 일이 없게)
  insert into public.jobs (title, hidden_at)
  values (btrim(p_title), case when p_hidden then now() else null end)
  returning id into new_id;

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

-- 사이트 서버(service_role)만 부를 수 있게. 회원·비회원은 못 부른다.
revoke execute on function public.import_job(text, text, text, date, text, text, text, integer, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.import_job(text, text, text, date, text, text, text, integer, text, text, text, text, text, boolean)
  to service_role;

-- Supabase에게 새 함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '공고 자동 등록 준비 완료' as 결과;
