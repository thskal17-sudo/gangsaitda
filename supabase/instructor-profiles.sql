-- 강사잇다 · 강사 프로필 (기관 의뢰가 오면 운영자가 골라 전달)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- - 전달에 동의한 회원만 프로필을 낸다. 회원 한 명당 한 줄.
-- - 내는 방법은 둘 중 하나: 강사잇다 양식으로 작성(method = 'form') 또는 파일 올리기(method = 'file').
-- - 파일은 공개되지 않는 저장소(instructor-profiles)에 '회원번호/파일' 로 둔다. 본인과 관리자만 읽는다.
-- - 회원 탈퇴하면 프로필 줄은 함께 지워진다 (파일은 사이트가 탈퇴할 때 지운다).

-- 1) 표 ------------------------------------------------------------------
create table if not exists public.instructor_profiles (
  member_id     uuid primary key references public.members (id) on delete cascade,
  consent_at    timestamptz not null default now(),   -- 기관 전달에 동의한 시각
  fields        text[] not null,                     -- 강의 분야 (아래 규칙 참고)
  regions       text[] not null,                     -- 활동 가능 지역 (아래 규칙 참고)
  method        text not null check (method in ('form', 'file')),
  career        text check (career is null or char_length(career) <= 2000),
  certificates  text check (certificates is null or char_length(certificates) <= 1000),
  intro         text check (intro is null or char_length(intro) <= 500),
  file_path     text,
  file_name     text check (file_name is null or char_length(file_name) <= 200),
  updated_at    timestamptz not null default now(),
  -- 양식이면 경력이, 파일이면 자기 폴더 안의 파일이 있어야 한다
  constraint instructor_profiles_content check (
    (method = 'form' and career is not null and char_length(trim(career)) > 0)
    or (method = 'file' and file_path is not null and file_path like member_id::text || '/%')
  )
);

-- 강의 분야: 정해진 목록에서 고른다 (lib/profile-schema.ts 의 PROFILE_FIELDS 와 같아야 한다).
-- 예전 판(글자로 적는 칸)을 이미 실행했다면 목록 방식으로 바꾼다. 그때 적어 둔 시험 값은 '기타'가 된다.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'instructor_profiles' and column_name = 'fields') = 'text' then
    alter table public.instructor_profiles drop constraint if exists instructor_profiles_fields_check;
    alter table public.instructor_profiles alter column fields type text[] using array['기타'];
  end if;
end
$$;
alter table public.instructor_profiles drop constraint if exists instructor_profiles_fields_check;
alter table public.instructor_profiles add constraint instructor_profiles_fields_check
  check (cardinality(fields) between 1 and 10
         and fields <@ array['진로·창업', '코딩·AI', '방과후(예체능)', '방과후(교과)', '독서·논술',
                             '리더십·소통', '직무·CS', '인문·교양', '힐링·건강', '기타']);

-- 활동 가능 지역: 권역 단위 (lib/profile-schema.ts 의 PROFILE_REGIONS 와 같아야 한다). 여러 번 실행해도 새 규칙으로 바뀐다.
alter table public.instructor_profiles drop constraint if exists instructor_profiles_regions_check;
alter table public.instructor_profiles add constraint instructor_profiles_regions_check
  check (cardinality(regions) between 1 and 7
         and regions <@ array['전국구', '경기권', '강원권', '충청권', '전라권', '경상권', '제주권']);

comment on table public.instructor_profiles is
  '강사 프로필. 기관 전달에 동의한 회원만. 운영자가 의뢰 기관에 골라 전달한다. 연락처는 섭외 확정 뒤에 알린다.';

-- 2) 누가 무엇을 할 수 있나 ------------------------------------------------
alter table public.instructor_profiles enable row level security;

drop policy if exists "회원은 자기 프로필을 읽는다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 읽는다"
  on public.instructor_profiles for select to authenticated
  using ((select auth.uid()) = member_id);

drop policy if exists "관리자는 모든 프로필을 읽는다" on public.instructor_profiles;
create policy "관리자는 모든 프로필을 읽는다"
  on public.instructor_profiles for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "회원은 자기 프로필을 낸다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 낸다"
  on public.instructor_profiles for insert to authenticated
  with check ((select auth.uid()) = member_id);

drop policy if exists "회원은 자기 프로필을 고친다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 고친다"
  on public.instructor_profiles for update to authenticated
  using ((select auth.uid()) = member_id)
  with check ((select auth.uid()) = member_id);

drop policy if exists "회원은 자기 프로필을 지운다" on public.instructor_profiles;
create policy "회원은 자기 프로필을 지운다"
  on public.instructor_profiles for delete to authenticated
  using ((select auth.uid()) = member_id);

revoke all on public.instructor_profiles from anon, authenticated;
grant select, insert, update, delete on public.instructor_profiles to authenticated;

-- 3) 파일 저장소 (공개 안 함, 한 파일 10MB 까지) ------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('instructor-profiles', 'instructor-profiles', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "강사는 자기 프로필 파일을 올린다" on storage.objects;
create policy "강사는 자기 프로필 파일을 올린다"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "강사는 자기 프로필 파일을 읽는다" on storage.objects;
create policy "강사는 자기 프로필 파일을 읽는다"
  on storage.objects for select to authenticated
  using (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "강사는 자기 프로필 파일을 지운다" on storage.objects;
create policy "강사는 자기 프로필 파일을 지운다"
  on storage.objects for delete to authenticated
  using (bucket_id = 'instructor-profiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "관리자는 프로필 파일을 읽는다" on storage.objects;
create policy "관리자는 프로필 파일을 읽는다"
  on storage.objects for select to authenticated
  using (bucket_id = 'instructor-profiles' and (select public.is_admin()));

-- Supabase에게 새 표·규칙이 생겼다고 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '강사 프로필 준비 완료' as 결과;
