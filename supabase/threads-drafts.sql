-- 강사잇다 · Threads '올릴 글' (홍보 담당이 쓴 글을 쌓아 두고, 운영자가 [올리기]를 눌러야 Threads 에 올라감)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
-- 먼저 threads-post.sql 을 실행해 두어야 합니다 (Threads 연결 표).
--
-- 표 하나. 사이트 서버(service_role)만 읽고 씁니다. 회원·비회원·관리자 화면 모두 직접 읽을 수 없습니다.
--   threads_drafts : 올릴 글. 받는 문(/api/threads/drafts)으로 들어오면 '대기',
--                    관리자 화면(/admin/threads)에서 [올리기] → '올림', [버리기] → '버림'.
--   글 하나는 많아야 약 2KB 라 평일마다 쌓여도 1년에 0.5MB 정도입니다.

create table if not exists public.threads_drafts (
  id          bigint generated always as identity primary key,
  body        text not null check (char_length(body) between 1 and 500),  -- Threads 글은 500자까지
  for_date    date,                          -- 어느 날 올릴 글인지 (같은 날짜 글은 하나만 받음)
  status      text not null default '대기' check (status in ('대기', '올리는 중', '올림', '버림')),
  thread_id   text,                          -- Threads 가 돌려준 글 번호
  error       text,                          -- 마지막으로 올리기 실패한 이유 (실패하면 다시 '대기')
  created_at  timestamptz not null default now(),
  decided_at  timestamptz                    -- 올리거나 버린 시각
);

comment on table public.threads_drafts is 'Threads 올릴 글. 운영자가 관리자 화면에서 [올리기]를 눌러야 올라간다. 사이트 서버만 읽고 쓴다.';
create unique index if not exists threads_drafts_for_date_key on public.threads_drafts (for_date);
create index if not exists threads_drafts_created_idx on public.threads_drafts (created_at desc);

alter table public.threads_drafts enable row level security;
revoke all on public.threads_drafts from public, anon, authenticated;
grant all on public.threads_drafts to service_role;
-- 읽기 규칙(policy)을 하나도 만들지 않으므로 service_role 말고는 아무도 못 읽는다.

-- Supabase에게 새 표가 생겼다고 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select 'Threads 올릴 글 준비 완료' as 결과;
