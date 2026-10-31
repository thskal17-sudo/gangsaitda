-- 강사잇다 · 홈 화면 '강사 경력에 더하는 교육과정' 광고 칸 3개 (운영자 화면 '광고 관리'에서 고침)
-- Supabase SQL Editor 에 통째로 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
-- 다시 실행해도 운영자가 광고 관리에서 고친 내용은 덮어쓰지 않습니다.

-- 1) 표 만들기 ------------------------------------------------------------
-- 칸 하나에 한 줄 (1·2·3번 칸). 과정 이름(name)이 비어 있으면 '교육 광고 모집합니다' 자리로 보인다.
create table if not exists public.home_ads (
  slot smallint primary key check (slot between 1 and 3),
  -- 과정 이름. 비어 있으면 광고 모집 자리
  name text check (char_length(name) <= 60),
  -- 카드 아래 한 줄. 예: "11월 10일 개강 · ○○교육원"
  provider text check (char_length(provider) <= 60),
  -- 누르면 갈 곳. https:// 로 시작하는 다른 사이트 주소, 또는 강사잇다 안의 주소("/courses/…")
  href text check (href is null or href ~ '^(https://|/)' and char_length(href) <= 500),
  -- 사진. "/" 로 시작하면 사이트 안의 그림, 아니면 아래 저장소(home-ads) 안의 파일 이름
  image text check (char_length(image) <= 300),
  -- 이 날(한국 날짜)까지 신청을 받는다. 다음 날부터 '지난 교육'으로 보인다
  until date,
  -- 지난 교육일 때 카드 아래에 보일 글
  ended_text text check (char_length(ended_text) <= 60),
  updated_at timestamptz not null default now()
);

-- 칸 3개를 미리 만든다. 1번 칸은 지금 홈에 있는 강사잇다 첫 교육 (2026-10-26, 지난 교육).
-- 이미 있는 칸은 건드리지 않는다 (on conflict do nothing).
insert into public.home_ads (slot, name, provider, href, image, until, ended_text) values
  (1, '선택받는 강사의 프로필, 뭐가 다를까요?', '10월 26일(월) 개강 · 자세히 보기 →', '/courses/starter-1026',
      '/courses/profile-class-1026.png', '2026-10-26', '10월 26일(월) 진행 · 지난 교육'),
  (2, null, null, null, null, null, null),
  (3, null, null, null, null, null, null)
on conflict (slot) do nothing;

-- 2) 읽기·고치기 규칙 ------------------------------------------------------
-- 홈 화면이라 누구나 읽는다. 고치기는 관리자만 (칸을 새로 만들거나 지우지는 않는다).
alter table public.home_ads enable row level security;

drop policy if exists "누구나 광고 칸을 읽는다" on public.home_ads;
create policy "누구나 광고 칸을 읽는다" on public.home_ads
  for select to anon, authenticated
  using (true);

drop policy if exists "관리자는 광고 칸을 고친다" on public.home_ads;
create policy "관리자는 광고 칸을 고친다" on public.home_ads
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.home_ads from anon, authenticated;
grant select on public.home_ads to anon, authenticated;
grant update on public.home_ads to authenticated;

-- 3) 사진 저장소 (공개, 한 장 5MB 까지, 그림 파일만) ---------------------------
-- 홈 화면에 보이는 그림이라 누구나 볼 수 있다. 올리기·지우기는 관리자만.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-ads', 'home-ads', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "관리자는 광고 사진을 올린다" on storage.objects;
create policy "관리자는 광고 사진을 올린다" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'home-ads' and (select public.is_admin()));

-- 지울 때 저장소가 파일을 먼저 찾아보므로 관리자에게 목록 보기도 허락한다 (그림 자체는 공개 주소로 누구나 봄)
drop policy if exists "관리자는 광고 사진 목록을 본다" on storage.objects;
create policy "관리자는 광고 사진 목록을 본다" on storage.objects
  for select to authenticated
  using (bucket_id = 'home-ads' and (select public.is_admin()));

drop policy if exists "관리자는 광고 사진을 지운다" on storage.objects;
create policy "관리자는 광고 사진을 지운다" on storage.objects
  for delete to authenticated
  using (bucket_id = 'home-ads' and (select public.is_admin()));

-- Supabase에게 새 표가 생겼다고 알리기 (이게 없으면 'schema cache' 오류가 날 수 있음)
notify pgrst, 'reload schema';

select slot as 칸, coalesce(name, '(광고 모집 자리)') as 과정 from public.home_ads order by slot;
