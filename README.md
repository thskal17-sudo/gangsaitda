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
휴대폰 폭에서는 **아래쪽**, PC에서는 **위쪽 오른쪽**에 **홈 / 공고 / 자격증 / 강사섭외 / 회원가입** 메뉴가 보이고,
눌러서 화면이 바뀌면 정상입니다.

## 폴더

| 위치 | 내용 |
|---|---|
| `app/page.tsx` | 홈 화면 (첫인사, 오늘 올라온 공고 수, 마감이 가까운 공고 5개, 바로가기) |
| `app/jobs/page.tsx` | 공고 목록 화면 (`?view=today` 면 오늘 올라온 공고만) |
| `app/jobs/[id]/page.tsx` | 공고 상세 화면 (회원 전용) |
| `app/signup/` | 회원가입 화면 (강사 / 기관 담당자 고르기, 기관은 기관명) |
| `app/login/` | 로그인 화면 |
| `app/certificates/` | 자격증 (준비 중) |
| `app/request/` | 강사섭외 의뢰서 (학교·기관이 회원가입 후 보냄) |
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
| `lib/request-schema.ts`, `lib/request-actions.ts` | 강사섭외 의뢰서 입력 규칙·보내기 |
| `components/privacy-consent.tsx` | 개인정보 동의 칸 (가입·의뢰서 함께 씀) |
| `lib/site.ts` | 운영 정보 (문의처 등) |
| `supabase/instructor-requests.sql` | 강사섭외 의뢰 표 (보내기만 되고 사이트에서는 못 읽음) |
| `supabase/instructor-requests-change-1.sql` | 의뢰 표에서 담당자 이메일을 필수로 (위 파일을 이미 실행한 경우) |
| `supabase/instructor-requests-change-2.sql` | 의뢰는 회원만 보내게 (위 파일들을 이미 실행한 경우) |
| `supabase/instructor-profiles.sql` | 강사 프로필 표와 파일 저장소 |
| `app/account/profile/` | 내 프로필 (기관 전달에 동의한 강사만) |
| `supabase/today-deadline-count.sql` | 오늘 마감인 공고 수 함수 (홈 주황 상자) |
| `supabase/today-job-count.sql` | 오늘 올라온 공고 수 함수 |
| `lib/courses.ts` | 홈 '교육과정' 카드 목록 (이름·이미지·링크) |
| `supabase/today-job-titles.sql` | 오늘 올라온 공고 목록 함수 (`/jobs?view=today`) |
| `supabase/jobs.sql` | 공고 표 두 개(jobs, job_details)를 만드는 SQL |
| `supabase/jobs-change-1.sql` | 공고 표에서 강사료·전화번호 칸 없애기 (옛 jobs.sql 을 실행한 경우만) |
| `supabase/jobs-change-2.sql` | 지원 방법을 선택 사항으로 (jobs.sql 을 이미 실행한 경우) |
| `app/admin/`, `lib/admin.ts`, `components/admin-shell.tsx` | 관리자 화면 (`/admin`, 관리자 명단에 있는 회원만) |
| `supabase/admins.sql` | 관리자 명단 표와 '관리자인가?' 확인 함수 |
| `app/admin/jobs/new/`, `lib/admin-job-schema.ts`, `lib/admin-job-actions.ts` | 관리자 · 공고 등록 화면과 저장 |
| `supabase/admin-job-create.sql` | 관리자만 공고를 올릴 수 있는 함수 (제목·상세를 한 번에 저장) |
| `app/admin/jobs/[id]/edit/`, `components/admin-job-form.tsx`, `components/admin-hide-button.tsx` | 관리자 · 공고 수정 화면, 등록·수정 공용 양식, 숨기기 버튼 |
| `components/admin-bulk-hide.tsx` | 관리자 · 공고 관리 목록에서 체크한 공고를 한꺼번에 숨기기·다시 올리기 |
| `supabase/admin-job-edit.sql` | 공고 수정·숨기기 함수 + 숨긴 공고를 사이트에서 빼는 규칙 |
| `app/admin/requests/`, `lib/admin-requests.ts`, `lib/admin-request-actions.ts`, `lib/request-status.ts`, `components/admin-request-status.tsx` | 관리자 · 강사섭외 의뢰 보기·처리 상태 바꾸기 |
| `supabase/admin-requests.sql` | 관리자만 의뢰를 읽고 상태를 바꾸게 하는 규칙·함수 |
| `app/admin/requests/[id]/`, `components/admin-request-card.tsx`, `components/admin-match-buttons.tsx`, `lib/admin-match-actions.ts`, `lib/match-status.ts` | 관리자 · 의뢰별 추천 강사 관리 (기관 확인, 추천 강사 붙이기·진행 상태·빼기) |
| `components/admin-profile-row.tsx` | 관리자 · 강사 프로필 줄과 분야·지역 거르기 단추 (프로필 화면·추천 강사 고르기 공용) |
| `supabase/request-matching.sql` | 의뢰를 낸 회원·기관 확인 칸, 추천 강사 표 (관리자만) |
| `app/account/requests/`, `lib/my-requests.ts`, `lib/my-request-actions.ts`, `components/my-request-buttons.tsx` | 기관 담당자 · 내 의뢰 (추천 강사 프로필·강의계획서 보기, 이 강사님으로 할게요, 다른 강사를 원해요) |
| `lib/request-files.ts`, `app/admin/requests/[id]/plan/` | 강의계획서 파일 규칙, 관리자 내려받기 |
| `supabase/request-portal.sql` | 강의계획서·기관 선택·다른 강사 요청 칸, 담당자용 함수, 강의계획서 저장소 |
| `app/admin/profiles/new/`, `app/admin/profiles/[id]/edit/`, `components/admin-instructor-form.tsx`, `lib/admin-instructor-*.ts` | 관리자 · 강사 직접 등록·고치기·지우기 (가입하지 않은 강사, 동의 확인 필수) |
| `supabase/admin-instructors.sql` | 운영자 등록 강사 표, 추천 강사 표 연결, 담당자 함수 갱신 |
| `app/admin/jobs/upload/`, `components/admin-excel-upload.tsx`, `lib/job-excel.ts` | 관리자 · 엑셀로 공고 여러 개 올리기 (미리보기 → 올리기) |
| `public/gangsaitda-job-template.xlsx` | 엑셀 올리기 양식 (공고·예시·안내 시트) |
| `app/api/jobs/import/route.ts`, `lib/job-import.ts`, `lib/supabase/service.ts` | 수집 프로그램이 공고를 바로 넣는 '받는 문' (비밀 열쇠 확인, 엑셀 올리기와 같은 규칙) |
| `supabase/job-import.sql` | 사이트 서버만 부를 수 있는 공고 저장 함수 (관리자 로그인 없이) |
| `components/region-tabs.tsx`, `lib/regions.ts` | 지역 탭 (전체·부산·울산·경남·경북). 권역 목록은 `lib/regions.ts` 한 곳 |
| `supabase/job-region-group.sql` | 비회원용 목록 함수에 권역 칸 추가 (지역 탭이 비회원에게도 동작) |
| `components/job-search.tsx`, `lib/job-search.ts` | 공고 검색칸 (`?q=검색어`). 제목·기관·지역에서 찾고, 띄어쓰기는 무시 |
| `app/admin/kakao/`, `app/api/kakao/`, `lib/kakao.ts`, `lib/kakao-actions.ts`, `components/kakao-buttons.tsx` | 관리자 · 카톡 알림 (운영자 카카오 계정 연결, 강사섭외 의뢰가 오면 '나와의 채팅'으로 알림) |
| `supabase/kakao-notify.sql` | 카톡 연결 정보(토큰) 표. 사이트 서버만 읽고 씀 |
| `app/robots.ts`, `app/sitemap.ts` | 검색엔진 안내문(robots.txt)과 사이트맵(sitemap.xml). 관리자·내 계정·api 는 검색 제외 |
| `app/admin/members/`, `lib/admin-members.ts`, `lib/admin-member-actions.ts`, `components/admin-member-type-button.tsx` | 관리자 · 회원 목록 (회원 종류 강사/기관 바꾸기, 엑셀(CSV) 내려받기 `app/admin/members/export/`) |
| `app/account/requests/[id]/posting/`, `lib/my-postings.ts`, `lib/my-posting-actions.ts`, `lib/posting-schema.ts` | 기관 담당자 · 강사 모집 공고 쓰기·고치기·모집 마감 (운영자 검토 뒤 공고 목록에 게시) |
| `components/admin-posting-review.tsx`, `lib/admin-posting-actions.ts` | 관리자 · 모집 공고 승인(공고 올리기)/반려(사유) |
| `supabase/request-postings.sql` | 모집 공고 표, jobs.request_id, 담당자·관리자 함수 |
| `components/feedback-form.tsx`, `lib/my-feedback*.ts`, `supabase/request-feedback.sql` | 기관 담당자 · 완료된 의뢰의 강의 만족도 (별점·의견). 운영자만 봄 |
| `app/jobs/[id]/apply/`, `lib/apply*.ts`, `supabase/job-apply.sql` | 강사 회원 · 공고에서 바로 지원하기 (프로필·파일·한마디·전달 동의). 지원자는 기관 내 의뢰·관리자 의뢰 상세에 함께 보임 |
| `app/account/sms/`, `lib/sms-consent*.ts`, `supabase/sms-consent.sql` | 교육·강의 섭외 소식 문자 수신 동의 (선택). 가입 때 체크, 회원이 직접 켜고 끔, 관리자 회원 목록에서 동의한 회원만 걸러 보기 |
| `supabase/member-type.sql` | 회원 종류(강사/기관)·기관명 칸, 가입 처리 함수 갱신, 관리자용 종류 바꾸기 함수 |
| `components/member-type-notice.tsx` | 종류가 맞지 않는 화면에 들어왔을 때 안내 (기관 회원 → 내 프로필, 강사 회원 → 강사섭외·내 의뢰) |
| `supabase/admin-members.sql` | 관리자만 모든 회원 정보를 읽게 하는 규칙 |
| `app/account/delete/`, `components/site-footer.tsx` | 회원 탈퇴 화면, 사이트 맨 아래(회원에게만 '회원 탈퇴' 링크) |
| `supabase/delete-account.sql` | 로그인한 회원이 자기 계정만 지우는 함수 |
| `supabase/setup-all.sql` | 새 Supabase 프로젝트에 전체 표·규칙·함수를 한 번에 설치 |
| `supabase/move-1-export.sql`, `supabase/move-2-import.sql` | 옛 프로젝트 → 새 프로젝트로 공고·의뢰 옮기기 |
| `supabase/move-3-members-export.sql`, `supabase/move-4-members-import.sql` | 옛 프로젝트 → 새 프로젝트로 회원 계정(비밀번호 포함)·관리자 명단 옮기기 |
| `vercel.json` | 사이트 서버 위치: 서울(icn1) |
| `supabase/admin-add.sql` | [운영자용] 회원을 관리자로 지정하기 |
| `lib/date.ts` | 날짜 계산 (한국 시간 기준) |
| `docs/SPEC.md` | 기획 문서 |

## 기술

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (회원) · react-hook-form + zod (입력 폼) · Vercel 배포
