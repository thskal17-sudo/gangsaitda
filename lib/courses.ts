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
 */

export type Course = {
  name: string;
  provider?: string;
  href?: string;
  image?: string;
  /** 이미지가 없을 때 쓰는 상자 색 */
  tone: "brand" | "accent" | "ok";
};

export const COURSES: Course[] = [{ name: "", tone: "brand" }, { name: "", tone: "accent" }, { name: "", tone: "ok" }];

/** 광고 모집 자리를 눌렀을 때: 운영 이메일로 문의 메일 쓰기 */
export const AD_INQUIRY_HREF = `mailto:${OPERATOR.email}?subject=${encodeURIComponent("[강사잇다] 교육 광고 문의")}`;
