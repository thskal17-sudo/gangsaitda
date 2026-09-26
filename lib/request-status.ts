/** 강사섭외 의뢰 처리 상태. 데이터베이스(supabase/instructor-requests.sql)의 규칙과 같다. */
export const REQUEST_STATUSES = ["접수", "처리 중", "완료"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return REQUEST_STATUSES.includes(value as RequestStatus);
}
