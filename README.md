# 강사잇다 (gangsa-itda)

강사와 기관을 연결하는 구인구직 플랫폼. 기획은 [`docs/SPEC.md`](docs/SPEC.md), 작업 규칙은 [`CLAUDE.md`](CLAUDE.md)를 봅니다.

한국엑스퍼트교육원 회사 홈페이지(`rinktree` 저장소)와는 **따로 운영**하는 별도 사이트입니다.

## 화면 띄워보기

터미널에 입력합니다.

```bash
npm install   # 처음 한 번만
npm run dev
```

브라우저에서 <http://localhost:3000> 을 엽니다.
휴대폰 폭에서는 **아래쪽**, PC에서는 **위쪽 오른쪽**에 **홈 / 공고** 메뉴가 보이고,
눌러서 화면이 바뀌면 정상입니다.

## 폴더

| 위치 | 내용 |
|---|---|
| `app/page.tsx` | 홈 화면 |
| `app/jobs/page.tsx` | 공고 목록 화면 |
| `app/jobs/[id]/page.tsx` | 공고 상세 화면 (회원 전용) |
| `app/signup/` | 회원가입 화면 |
| `app/login/` | 로그인 화면 |
| `app/certificates/` | 자격증 (준비 중) |
| `app/request/` | 기관의뢰 (준비 중) |
| `app/find-email/` | 이메일(아이디) 찾기 화면 |
| `app/find-password/` | 비밀번호 찾기 안내 (지금은 운영자 문의) |
| `app/layout.tsx` | 모든 화면을 감싸는 틀 (위쪽 띠, 본문 폭, 휴대폰/PC 구분) |
| `app/globals.css` | 색·글꼴·모서리 값 (디자인 토큰) |
| `components/nav-tabs.tsx` | 메뉴 목록 (하단 탭과 위쪽 메뉴가 함께 씀, 마지막 칸은 회원가입/로그아웃) |
| `components/bottom-nav.tsx` | 휴대폰 하단 탭 |
| `components/top-nav.tsx` | PC 위쪽 메뉴 |
| `components/job-card.tsx` | 공고 카드 한 장, 남은 날짜 배지 |
| `components/job-detail.tsx` | 상세 화면 조각 (요약, 지원 버튼, 회원 전용 안내) |
| `components/auth-form.tsx` | 가입·로그인 화면 조각 (입력칸, 버튼, 오류 안내) |
| `lib/jobs.ts` | 공고 데이터 (Supabase 에서 읽음) |
| `lib/member.ts` | 회원인지 확인 (Supabase 로그인) |
| `lib/auth-schema.ts` | 가입·로그인 입력 규칙 (화면과 서버가 함께 씀) |
| `lib/auth-actions.ts` | 가입·로그인 처리 (서버) |
| `lib/safe-next.ts` | 가입·로그인 뒤 돌아갈 주소 확인 (사이트 안 주소만) |
| `lib/supabase/` | Supabase 연결 |
| `proxy.ts` | 화면을 열 때마다 로그인 유지 기간을 연장 |
| `supabase/members.sql` | 회원 정보 표를 만드는 SQL (Supabase SQL Editor 에 붙여넣음) |
| `supabase/find-email.sql` | 이메일 찾기 함수 (이메일을 가려서 돌려줌) |
| `supabase/admin-reset-password.sql` | [운영자용] 회원에게 임시 비밀번호 정해 주기 |
| `lib/site.ts` | 운영 정보 (문의처 등) |
| `supabase/jobs.sql` | 공고 표 두 개(jobs, job_details)를 만드는 SQL |
| `supabase/jobs-change-1.sql` | 공고 표에서 강사료·전화번호 칸 없애기 (옛 jobs.sql 을 실행한 경우만) |
| `supabase/jobs-change-2.sql` | 지원 방법을 선택 사항으로 (jobs.sql 을 이미 실행한 경우) |
| `lib/date.ts` | 날짜 계산 (한국 시간 기준) |
| `docs/SPEC.md` | 기획 문서 |

## 기술

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (회원) · react-hook-form + zod (입력 폼) · Vercel 배포
