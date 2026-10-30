-- 강사잇다 · 화면 열람 수 세기 + 운영자 현황(대시보드)용 숫자
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
-- 예전 판을 이미 실행했어도 이 파일을 다시 실행하면 됩니다. 쌓인 기록은 그대로 남습니다.
--
-- 화면이 한 번 열릴 때마다 한 줄씩 적습니다. 적는 것은 '언제 · 어느 화면 · 어디서 왔는지' 뿐입니다.
--   어디서 왔는지 = 경로 종류(네이버 블로그 등) + 사이트 이름(예: blog.naver.com, 주소 전체는 아님) + 홍보 링크 이름표(?from=…)
-- 누가 왔는지(IP 주소, 쿠키, 회원 정보)는 적지 않습니다. 그래서 개인정보 동의가 필요 없습니다.
-- 이 표는 사이트도, 회원도 직접 읽을 수 없습니다. 운영자만 아래 admin_site_stats 함수로 '개수'만 봅니다.

-- 1) 표 만들기 ------------------------------------------------------------
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  viewed_at timestamptz not null default now(),
  -- 열린 화면 주소. 예: "/jobs/123" (물음표 뒤 검색어 등은 적지 않음)
  path text not null check (char_length(path) between 1 and 200),
  -- 들어온 경로 종류. 사이트 안에서 다른 화면으로 옮겨 간 경우는 'internal' (lib/page-view.ts 의 SOURCES)
  source text not null
);

-- 들어온 사이트 이름 (예: blog.naver.com). 처음 들어온 화면에서만, 이전 주소가 있을 때만
alter table public.page_views add column if not exists ref_host text check (char_length(ref_host) <= 100);
-- 홍보 링크 이름표 (주소 끝의 ?from=이름 또는 utm_source). 처음 들어온 화면에서만
alter table public.page_views add column if not exists campaign text check (char_length(campaign) <= 50);

-- 경로 종류는 영어 소문자·밑줄만 (종류가 늘어도 SQL 을 다시 고치지 않게)
alter table public.page_views drop constraint if exists page_views_source_check;
alter table public.page_views add constraint page_views_source_check check (source ~ '^[a-z_]{1,30}$');

create index if not exists page_views_viewed_at_idx on public.page_views (viewed_at);

-- 아무도 직접 읽거나 쓸 수 없게 잠근다 (읽기 규칙을 하나도 두지 않음).
alter table public.page_views enable row level security;

-- 2) 한 줄 적기 (사이트 서버가 부름. 비회원도 가능) --------------------------
create or replace function public.record_page_view(p_path text, p_source text, p_ref_host text, p_campaign text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.page_views (path, source, ref_host, campaign)
  values (p_path, p_source, nullif(p_ref_host, ''), nullif(p_campaign, ''));
$$;

revoke execute on function public.record_page_view(text, text, text, text) from public;
grant execute on function public.record_page_view(text, text, text, text) to anon, authenticated;

-- 예전 판 사이트(경로 종류만 보내던 때)도 이 SQL 을 실행한 뒤 바로 끊기지 않고 기록되게 남겨 둔다.
create or replace function public.record_page_view(p_path text, p_source text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select public.record_page_view(p_path, p_source, null, null);
$$;

revoke execute on function public.record_page_view(text, text) from public;
grant execute on function public.record_page_view(text, text) to anon, authenticated;

-- 3) 운영자 현황 숫자 (관리자만) --------------------------------------------
-- p_from(한국 날짜)부터 오늘까지의 숫자를 한 번에 돌려준다.
-- 열람 기록은 계속 쌓이므로, 날짜 칸(viewed_at)의 찾아보기 목록(index)을 쓰도록 '시각 범위'로 거른다.
--   daily:     날짜별 열람 수 · 새 가입자 수 · 새 강사섭외 의뢰 수
--   sources:   들어온 경로 종류별 수 (사이트 안 이동은 빼고, 처음 들어온 화면만)
--   hosts:     들어온 사이트 이름별 수 — 많은 순 20개
--   campaigns: 홍보 링크 이름표별 수 — 많은 순 20개
--   top_jobs:  가장 많이 열린 공고 5개 (제목 포함)
create or replace function public.admin_site_stats(p_from date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  since timestamptz := p_from::timestamp at time zone 'Asia/Seoul';
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day, 'views', d.views, 'members', d.members, 'requests', d.requests) order by d.day)
      from (
        select g.day::date as day,
               (select count(*) from public.page_views v
                 where v.viewed_at >= (g.day::date)::timestamp at time zone 'Asia/Seoul'
                   and v.viewed_at < (g.day::date + 1)::timestamp at time zone 'Asia/Seoul') as views,
               (select count(*) from public.members m where (m.created_at at time zone 'Asia/Seoul')::date = g.day::date) as members,
               (select count(*) from public.instructor_requests r where (r.created_at at time zone 'Asia/Seoul')::date = g.day::date) as requests
        from generate_series(p_from, (now() at time zone 'Asia/Seoul')::date, interval '1 day') as g(day)
      ) d
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', s.source, 'count', s.n) order by s.n desc)
      from (
        select v.source, count(*) as n
        from public.page_views v
        where v.viewed_at >= since and v.source <> 'internal'
        group by v.source
      ) s
    ), '[]'::jsonb),
    'hosts', coalesce((
      select jsonb_agg(jsonb_build_object('host', h.ref_host, 'count', h.n) order by h.n desc, h.ref_host)
      from (
        select v.ref_host, count(*) as n
        from public.page_views v
        where v.viewed_at >= since and v.source <> 'internal' and v.ref_host is not null
        group by v.ref_host
        order by n desc, v.ref_host
        limit 20
      ) h
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.campaign, 'count', c.n) order by c.n desc, c.campaign)
      from (
        select v.campaign, count(*) as n
        from public.page_views v
        where v.viewed_at >= since and v.campaign is not null
        group by v.campaign
        order by n desc, v.campaign
        limit 20
      ) c
    ), '[]'::jsonb),
    'top_jobs', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.job_id, 'title', j.title, 'count', t.n) order by t.n desc, t.job_id desc)
      from (
        select substring(v.path from 7)::bigint as job_id, count(*) as n
        from public.page_views v
        where v.viewed_at >= since and v.path ~ '^/jobs/[0-9]{1,15}$'
        group by 1
        order by n desc, job_id desc
        limit 5
      ) t
      join public.jobs j on j.id = t.job_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_site_stats(date) from public, anon;
grant execute on function public.admin_site_stats(date) to authenticated;

-- Supabase에게 새 표·함수가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

select '열람 수 세기 준비 완료' as 결과;
