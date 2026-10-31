-- 강사잇다 · Threads 자동 게시 (새 공고가 사이트에 올라가면 운영자 Threads 계정에 제목 + 링크를 올림)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 표 두 개. 둘 다 사이트 서버(service_role)만 읽고 씁니다. 회원·비회원·관리자 화면 모두 직접 읽을 수 없습니다.
--   1) threads_tokens : 운영자가 관리자 화면(/admin/threads)에서 'Threads 연결'을 누르면 Meta 가 준 열쇠(토큰)를 한 줄로 보관
--   2) threads_posts  : 어떤 공고를 Threads 에 올렸는지 (같은 공고를 두 번 올리지 않게)

create table if not exists public.threads_tokens (
  id            integer primary key default 1 check (id = 1),  -- 항상 한 줄
  access_token  text not null,               -- 장기 토큰 (60일). 공고를 올릴 때 하루 한 번 자동으로 늘림
  expires_at    timestamptz not null,
  user_id       text not null,               -- Threads 계정 번호
  username      text,                        -- Threads 계정 이름 (관리자 화면에 보여줌)
  connected_at  timestamptz not null default now(),
  refreshed_at  timestamptz not null default now(),  -- 토큰을 마지막으로 받거나 늘린 시각
  updated_at    timestamptz not null default now(),
  last_error    text                         -- 마지막으로 올리기 실패한 이유 (관리자 화면에 보여줌)
);

comment on table public.threads_tokens is 'Threads 자동 게시 연결 정보. 사이트 서버만 읽고 쓴다.';

create table if not exists public.threads_posts (
  job_id      bigint primary key references public.jobs (id) on delete cascade,
  status      text not null default '올리는 중' check (status in ('올리는 중', '올림', '실패')),
  thread_id   text,                          -- Threads 가 돌려준 글 번호 (여러 공고를 한 글로 올리면 같은 번호)
  error       text,
  created_at  timestamptz not null default now(),
  posted_at   timestamptz
);

comment on table public.threads_posts is 'Threads 에 올린 공고. 공고마다 한 줄이라 같은 공고는 다시 올리지 않는다.';
create index if not exists threads_posts_created_idx on public.threads_posts (created_at desc);

alter table public.threads_tokens enable row level security;
alter table public.threads_posts enable row level security;
revoke all on public.threads_tokens from public, anon, authenticated;
revoke all on public.threads_posts from public, anon, authenticated;
grant all on public.threads_tokens to service_role;
grant all on public.threads_posts to service_role;
-- 읽기 규칙(policy)을 하나도 만들지 않으므로 service_role 말고는 아무도 못 읽는다.

-- Supabase에게 새 표가 생겼다고 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select 'Threads 자동 게시 준비 완료' as 결과;
