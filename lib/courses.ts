import { OPERATOR } from "@/lib/site";

/*
 * 홈 화면 '강사 경력에 더하는 교육과정' 칸의 카드 3개. 바뀌면 여기만 고친다.
 * 광고가 들어오지 않은 칸은 '교육 광고 모집합니다' 자리로 보이고, 누르면 운영 이메일로 광고 문의를 쓴다.
 *
 * 광고(과정)가 들어오면 그 칸에 적는다:
 * - name: 과정 이름 (비워 두면 광고 모집 자리)
 * - provider: 과정을 운영하는 기관 이름
 * - href: 눌렀을 때 갈 곳 (그 기관의 과정 소개·신청 주소)
 * - image: 대표 이미지 주소 (public 폴더 안, 예: "/courses/course-1.jpg"). 없으면 색깔 상자
 * - until: 이 날(한국 날짜, 예: "2026-10-26")까지 신청을 받는다. 다음 날 0시부터 저절로 '지난 교육'으로 바뀌어
 *   그림은 흐리게, 아래 글은 endedText 로 보이고, 눌러도 신청폼으로 가지 않는다 (카드는 그대로 남는다)
 *
 * 다른 사이트(신청폼 등)로 가는 주소는 새 창으로 연다.
 */

export type Course = {
  name: string;
  provider?: string;
  href?: string;
  image?: string;
  /** 신청을 받는 마지막 날 (한국 날짜 YYYY-MM-DD). 지나면 '지난 교육'. 없으면 계속 신청 중 */
  until?: string;
  /** 지난 교육일 때 provider 대신 보이는 글 */
  endedText?: string;
  /** 지난 교육인지 (coursesOn 이 정한다) */
  ended?: boolean;
  /** 이미지가 없을 때 쓰는 상자 색 */
  tone: "brand" | "accent" | "ok";
};

export const COURSES: Course[] = [
  {
    // 강사잇다 첫 교육 (2026-10-26 개강). 신청은 네이버 폼, 자세한 내용은 강사잇다 당근모임
    name: "선택받는 강사의 프로필, 뭐가 다를까요?",
    provider: "10월 26일(월) 개강 · 신청하기 →",
    href: "https://form.naver.com/response/7WQCVJo7Qor",
    image: "/courses/profile-class-1026.png",
    until: "2026-10-26",
    endedText: "10월 26일(월) 진행 · 지난 교육",
    tone: "brand",
  },
  { name: "", tone: "accent" },
  { name: "", tone: "ok" },
];

/** 오늘(한국 날짜) 보여 줄 카드. 신청 기간(until)이 지난 과정은 '지난 교육'으로 표시한다. */
export function coursesOn(today: string): Course[] {
  return COURSES.map((c) => ({ ...c, ended: Boolean(c.until && c.until < today) }));
}

/** 광고 모집 자리를 눌렀을 때: 운영 이메일로 문의 메일 쓰기 */
export const AD_INQUIRY_HREF = `mailto:${OPERATOR.email}?subject=${encodeURIComponent("[강사잇다] 교육 광고 문의")}`;
