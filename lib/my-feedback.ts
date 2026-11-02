import { seoulDateOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 강사별 강의 만족도. 데이터베이스 함수(my_match_feedbacks, supabase/match-feedback.sql)가
 * 내 의뢰에서 '확정'된 강사와 내가 남긴 평가만 돌려준다 (의뢰가 '완료'돼도 이름과 내 평가는 보인다).
 * 남기기·고치기는 lib/my-feedback-actions.ts. 원문은 운영자만 보고, 다른 기관에는 요약(건수·평균·재섭외 비율)만 보인다.
 */

export type MyMatchFeedback = {
  matchId: string;
  name: string;
  /** 아직 안 남겼으면 없음 */
  rating?: number;
  /** 다시 부르고 싶은지 */
  rehire?: boolean;
  comment?: string;
  /** 마지막으로 남긴 날 (한국 날짜) */
  updatedDate?: string;
};

type Row = {
  match_id: number;
  name: string;
  rating: number | null;
  rehire: boolean | null;
  comment: string | null;
  updated_at: string | null;
};

/** 내 의뢰의 확정된 강사들과 내가 남긴 만족도. 확정된 강사가 없으면 빈 목록 */
export async function getMyMatchFeedbacks(requestId: string): Promise<MyMatchFeedback[]> {
  if (!/^\d{1,15}$/.test(requestId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_match_feedbacks", { p_request_id: Number(requestId) });
  if (error) {
    console.error("[feedback] 만족도 읽기 실패", error.code, error.message);
    return [];
  }
  return (data as Row[]).map((r) => ({
    matchId: String(r.match_id),
    name: r.name,
    rating: r.rating ?? undefined,
    rehire: r.rehire ?? undefined,
    comment: r.comment?.trim() || undefined,
    updatedDate: r.updated_at ? seoulDateOf(r.updated_at) : undefined,
  }));
}
