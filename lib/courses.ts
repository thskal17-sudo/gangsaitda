/*
 * 홈 화면 '교육과정' 칸에 보여줄 과정 목록. 과정이 정해지면 여기만 고친다.
 * - name: 과정 이름. 비워 두면 카드에 '과정 이름 준비 중'이 나온다.
 * - image: 대표 이미지 주소 (public 폴더 안, 예: "/courses/course-1.jpg"). 없으면 색깔 상자로 대신한다.
 * - href: 카드를 눌렀을 때 갈 곳. 지금은 모두 자격증 화면.
 */

export type Course = {
  name: string;
  image?: string;
  href: string;
  /** 이미지가 없을 때 쓰는 상자 색 */
  tone: "brand" | "accent" | "ok";
};

export const COURSES: Course[] = [
  { name: "", href: "/certificates", tone: "brand" },
  { name: "", href: "/certificates", tone: "accent" },
  { name: "", href: "/certificates", tone: "ok" },
];

/** 과정 카드에 이름과 함께 적는 운영 기관 */
export const COURSE_PROVIDER = "한국엑스퍼트교육원";
