-- 강사잇다 · 관심 공고 담기 (강사 회원이 공고를 담아 두고, 지원했으면 '지원했어요' 표시)
-- member-type.sql 을 먼저 실행한 뒤, Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다.
-- 여러 번 실행해도 괜찮습니다.
--
-- - 한 줄 = "누가, 어떤 공고를, 언제 담았고, 언제 지원했다고 표시했는지". 본인만 읽고 쓴다 (운영자·기관에도 안 보임).
-- - 강사 회원만 담을 수 있다 (기관 회원은 화면에 버튼이 없고, 여기서도 한 번 더 막는다).
-- - 공고가 지워지거나 회원이 탈퇴하면 함께 지워진다.

create table if not exists public.saved_jobs (
  member_id  uuid not null default auth.uid() references public.members (id) on delete cascade,
  job_id     bigint not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),   -- 담은 시각
  applied_at timestamptz,                           -- '지원했어요'를 누른 시각. 비어 있으면 아직 안 함
  primary key (member_id, job_id)
);

comment on table public.saved_jobs is '강사 회원의 관심 공고. 본인만 읽고 쓴다. 지원했어요 표시는 강사 본인의 기록일 뿐 기관에 전달되지 않는다.';

create index if not exists saved_jobs_job_idx on public.saved_jobs (job_id);

alter table public.saved_jobs enable row level security;

drop policy if exists "회원은 자기 관심 공고를 읽는다" on public.saved_jobs;
create policy "회원은 자기 관심 공고를 읽는다"
  on public.saved_jobs for select to authenticated
  using (member_id = (select auth.uid()));

drop policy if exists "강사 회원은 관심 공고를 담는다" on public.saved_jobs;
create policy "강사 회원은 관심 공고를 담는다"
  on public.saved_jobs for insert to authenticated
  with check (member_id = (select auth.uid())
              and exists (select 1 from public.members m where m.id = (select auth.uid()) and m.member_type = '강사'));

drop policy if exists "회원은 지원했어요 표시를 바꾼다" on public.saved_jobs;
create policy "회원은 지원했어요 표시를 바꾼다"
  on public.saved_jobs for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

drop policy if exists "회원은 관심 공고를 뺀다" on public.saved_jobs;
create policy "회원은 관심 공고를 뺀다"
  on public.saved_jobs for delete to authenticated
  using (member_id = (select auth.uid()));

revoke all on public.saved_jobs from anon, authenticated;
grant select, delete on public.saved_jobs to authenticated;
grant insert (job_id) on public.saved_jobs to authenticated;
grant update (applied_at) on public.saved_jobs to authenticated;

-- Supabase에게 새 표를 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '관심 공고 준비 완료' as 결과;
