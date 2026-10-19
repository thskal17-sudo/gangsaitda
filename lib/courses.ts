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
 *   그림은 흐리게, 아래 글은 endedText 로 보인다 (카드는 그대로 남는다)
 * - slug + detail: 강사잇다 안의 교육 소개 화면(/courses/slug)을 만든다. 카드를 누르면 그 화면으로 가고,
 *   소개 화면의 [신청하기]가 href(신청폼)를 연다. 지난 교육이면 소개 화면은 남고 신청 버튼만 사라진다.
 *   detail 이 없으면 카드가 href 로 바로 간다 (지난 교육이면 눌리지 않는다).
 *
 * 다른 사이트(신청폼 등)로 가는 주소는 새 창으로 연다.
 */

/** 교육 소개 화면(/courses/slug)에 들어가는 내용 */
export type CourseDetail = {
  /** 맨 위 노란 띠의 이름. 예: "강사 입문 특강" */
  series: string;
  /** 큰 제목. [강조] 처럼 대괄호로 감싼 부분은 주황색 */
  headline: string;
  lead: string;
  forWhom: string[];
  curriculumTitle: string;
  curriculum: { title: string; lines: string[] }[];
  /** 커리큘럼 아래 작은 글 */
  curriculumNote?: string;
  /** 일시 상자 */
  dateLabel: string;
  sessionNote: string;
  sessions: { label: string; time: string }[];
  fee: string;
  capacity?: string;
  perk?: string;
  /** 신청 방법 이름. 예: "네이버폼" */
  applyVia: string;
  /** 더 알아볼 곳 안내 (링크 없이 글만) */
  moreInfo?: string;
};

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
  /** 교육 소개 화면 주소 이름 (/courses/slug). detail 과 함께 */
  slug?: string;
  detail?: CourseDetail;
  /** 이미지가 없을 때 쓰는 상자 색 */
  tone: "brand" | "accent" | "ok";
};

export const COURSES: Course[] = [
  {
    // 강사잇다 첫 교육 (2026-10-26 개강). 신청은 네이버 폼, 자세한 내용은 강사잇다 당근모임
    name: "선택받는 강사의 프로필, 뭐가 다를까요?",
    provider: "10월 26일(월) 개강 · 자세히 보기 →",
    href: "https://form.naver.com/response/7WQCVJo7Qor",
    image: "/courses/profile-class-1026.png",
    until: "2026-10-26",
    endedText: "10월 26일(월) 진행 · 지난 교육",
    tone: "brand",
    slug: "starter-1026",
    detail: {
      series: "강사 입문 특강",
      headline: "강사는 자격증이 아니라 [시작]으로 됩니다.",
      lead: "10월 26일, 첫 걸음을 함께 떼어 봐요.",
      forWhom: [
        "강사가 되고 싶은데 어디서부터 시작해야 할지 막막한 분",
        "내 경험을 강의로 만들고 싶은 분",
        "나만의 강사 프로필을 완성하고 싶은 분",
      ],
      curriculumTitle: "2시간 동안 이렇게 진행됩니다.",
      curriculum: [
        { title: "강사 시장, 어떻게 생겼나", lines: ["기관·기업·플랫폼별 진입 경로와 섭외 구조"] },
        {
          title: "나는 어떤 강사인가",
          lines: ["내 경험을 강의 주제로 바꾸는 포지셔닝 공식", "한 줄로 설명되는 '강사 소개 문장' 만들기"],
        },
        {
          title: "강사 프로필 작성 실습",
          lines: ["기관 담당자가 보는 프로필의 N가지 요소", "템플릿에 직접 채우고 그 자리에서 피드백"],
        },
      ],
      curriculumNote: "이론 1시간 + 실습 1시간. 듣기만 하는 강의가 아닙니다.",
      dateLabel: "10월 26일 (월)",
      sessionNote: "둘 중 택1 · 온라인(ZOOM) 진행",
      sessions: [
        { label: "오전반", time: "10:00–12:00" },
        { label: "저녁반", time: "19:00–21:00" },
      ],
      fee: "10,000원",
      capacity: "20명 (오전 10명 · 저녁 10명)",
      perk: "참가자 전원 프로필 템플릿 3종 제공",
      applyVia: "네이버폼",
      moreInfo: "자세한 소식은 강사잇다 당근모임에서도 볼 수 있어요.",
    },
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

/** 교육 소개 화면에 쓸 과정 (주소 이름으로 찾기). 없으면 null */
export function courseBySlug(slug: string, today: string): Course | null {
  return coursesOn(today).find((c) => c.slug === slug && c.detail) ?? null;
}
