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
| `app/layout.tsx` | 모든 화면을 감싸는 틀 (위쪽 띠, 본문 폭, 휴대폰/PC 구분) |
| `app/globals.css` | 색·글꼴·모서리 값 (디자인 토큰) |
| `components/nav-tabs.tsx` | 메뉴 목록 (하단 탭과 위쪽 메뉴가 함께 씀) |
| `components/bottom-nav.tsx` | 휴대폰 하단 탭 |
| `components/top-nav.tsx` | PC 위쪽 메뉴 |
| `components/job-card.tsx` | 공고 카드 한 장, 남은 날짜 배지 |
| `components/job-detail.tsx` | 상세 화면 조각 (요약, 지원 버튼, 회원 전용 안내) |
| `lib/jobs.ts` | 공고 데이터 (지금은 샘플) |
| `lib/member.ts` | 회원인지 확인 (지금은 항상 비회원) |
| `lib/date.ts` | 날짜 계산 (한국 시간 기준) |
| `docs/SPEC.md` | 기획 문서 |

## 기술

Next.js (App Router) · TypeScript · Tailwind CSS · Vercel 배포
