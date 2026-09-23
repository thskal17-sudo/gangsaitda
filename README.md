# 강사잇다 (gangsa-itda)

강사와 기관을 연결하는 구인구직 플랫폼. 기획은 [`docs/SPEC.md`](docs/SPEC.md), 작업 규칙은 [`CLAUDE.md`](CLAUDE.md)를 봅니다.

## 화면 띄워보기

터미널에 입력합니다.

```bash
npm install   # 처음 한 번만
npm run dev
```

브라우저에서 <http://localhost:3000> 을 엽니다.
아래쪽에 **홈 / 공고** 탭 두 개가 보이고, 눌러서 화면이 바뀌면 정상입니다.

## 폴더

| 위치 | 내용 |
|---|---|
| `app/page.tsx` | 홈 화면 |
| `app/jobs/page.tsx` | 공고 화면 |
| `app/layout.tsx` | 모든 화면을 감싸는 틀 (위쪽 띠, 하단 탭 위치) |
| `app/globals.css` | 색·글꼴·모서리 값 (디자인 토큰) |
| `components/bottom-nav.tsx` | 하단 탭 메뉴 |
| `docs/SPEC.md` | 기획 문서 |

## 기술

Next.js (App Router) · TypeScript · Tailwind CSS · Vercel 배포
