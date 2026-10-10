-- 강사잇다 · 카톡 알림 연결 정보 (강사섭외 의뢰가 오면 운영자 카톡 '나와의 채팅'으로 알림)
-- Supabase SQL Editor 에 붙여넣고 Run 을 한 번 누릅니다. 여러 번 실행해도 괜찮습니다.
--
-- 운영자가 관리자 화면(/admin/kakao)에서 '카카오 연결'을 누르면 카카오가 준 열쇠(토큰)를 이 표에 한 줄로 보관합니다.
-- 사이트 서버(service_role)만 읽고 씁니다. 회원·비회원·관리자 화면 모두 이 표를 직접 읽을 수 없습니다.

create table if not exists public.kakao_tokens (
  id                  integer primary key default 1 check (id = 1),  -- 항상 한 줄
  access_token        text not null,
  access_expires_at   timestamptz not null,      -- 보통 6시간 뒤
  refresh_token       text not null,
  refresh_expires_at  timestamptz not null,      -- 보통 2달 뒤. 지나면 관리자 화면에서 다시 연결
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_error          text                       -- 마지막으로 보내기 실패한 이유 (관리자 화면에 보여줌)
);

comment on table public.kakao_tokens is '카톡 알림(나에게 보내기) 연결 정보. 사이트 서버만 읽고 쓴다.';

alter table public.kakao_tokens enable row level security;
revoke all on public.kakao_tokens from public, anon, authenticated;
grant all on public.kakao_tokens to service_role;
-- 읽기 규칙(policy)을 하나도 만들지 않으므로 service_role 말고는 아무도 못 읽는다.

-- Supabase에게 새 표가 생겼다고 알리기
notify pgrst, 'reload schema';

-- 이 줄이 결과 칸에 보이면 끝난 것입니다.
select '카톡 알림 준비 완료' as 결과;
