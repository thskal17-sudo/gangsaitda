/**
 * 추천 강사 진행 상태. 데이터베이스(supabase/request-matching.sql)의 규칙과 같다.
 *   추천: 운영자가 의뢰에 붙임 → 검토 중: 기관이 프로필을 보는 중 → 연락 중: 운영자가 강사·기관을 잇는 중
 *   → 확정(섭외 성사, 이때 기관에 강사 연락처를 알린다) 또는 불발
 */
export const MATCH_STATUSES = ["추천", "검토 중", "연락 중", "확정", "불발"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export function isMatchStatus(value: unknown): value is MatchStatus {
  return MATCH_STATUSES.includes(value as MatchStatus);
}

/** 상태 배지 색 */
export const MATCH_STATUS_STYLE: Record<MatchStatus, string> = {
  추천: "bg-brand/10 text-brand",
  "검토 중": "bg-accent/10 text-accent",
  "연락 중": "bg-accent text-white",
  확정: "bg-ok text-white",
  불발: "bg-bg text-muted",
};
