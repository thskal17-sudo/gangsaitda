/**
 * 사이트 곳곳에 보여주는 운영 정보. 바뀌면 여기만 고친다.
 */

/** 비밀번호를 잊은 회원이 연락할 곳 (사이트에 공개됨). 정해지기 전에는 null. */
export const SUPPORT_CONTACT: string | null = null;

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
  mailOrderNumber: null as string | null,
  /** 직업정보제공사업 신고번호 (예: 부산북부 제2026-0호) */
  jobInfoNumber: null as string | null,
  /** 이메일 (임시) */
  email: "thskal17@gmail.com",
};
