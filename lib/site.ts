/**
 * 사이트 곳곳에 보여주는 운영 정보. 바뀌면 여기만 고친다.
 */

/**
 * 사이트 대표 주소. 공유 미리보기(app/layout.tsx)와 비밀번호 재설정 메일 링크가 이 주소를 쓴다.
 * gangsaitda.com 으로 들어오면 Vercel 이 www 로 넘긴다. Supabase → Authentication → URL Configuration 의 Site URL 과 같아야 한다.
 */
export const SITE_URL = "https://www.gangsaitda.com";

/**
 * 운영자 정보. 사이트 맨 아래(푸터)에 공개된다.
 * 값이 null 인 항목은 화면에 나오지 않는다 (신고번호가 나오면 여기에 적는다).
 */
export const OPERATOR = {
  /** 상호 */
  name: "한국엑스퍼트교육원",
  /** 대표자 */
  representative: "박서현",
  /** 주소 */
  address: "부산광역시 북구 낙동대로 1694번길 4 3층",
  /** 사업자등록번호 */
  businessNumber: "169-10-02403",
  /** 통신판매업 신고번호 (예: 제 2026-부산북구-0000 호) */
  mailOrderNumber: "제 2026-부산북구-0455호" as string | null,
  /** 직업정보제공사업 신고번호 (예: 부산북부 제2026-0호) */
  jobInfoNumber: null as string | null,
  /** 이메일 (임시) */
  email: "thskal17@gmail.com",
};

/** 개인정보처리방침(/privacy)에 들어가는 값 */
export const PRIVACY = {
  /** 개인정보 보호책임자 (대표자가 맡음) */
  officer: `${OPERATOR.representative} (대표자)`,
  /** 보호책임자 연락처 */
  officerEmail: OPERATOR.email,
  /** 시행일 */
  effectiveDate: "2026년 10월 4일",
  /**
   * 회원 정보가 저장되는 Supabase 데이터베이스의 위치 (Supabase → Project Settings → General → Region).
   * 사이트 서버(Vercel)도 같은 곳에서 돈다 (vercel.json 의 regions).
   */
  databaseRegion: "대한민국 (서울)",
};
