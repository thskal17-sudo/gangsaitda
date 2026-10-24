import { seoulDateOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 강의 만족도. 데이터베이스 함수(my_feedback, supabase/request-feedback.sql)가 내 의뢰 것만 돌려준다.
 * 남기기·고치기는 lib/my-feedback-actions.ts. 운영자만 본다 (lib/admin-requests.ts 의 getFeedbacks).
 */

export type MyFeedback = {
  rating: number;
  comment?: string;
  /** 마지막으로 남긴 날 (한국 날짜) */
  updatedDate: string;
};

type Row = { rating: number; comment: string | null; updated_at: string };

/** 내 의뢰에 남긴 만족도. 아직 안 남겼으면 null */
export async function getMyFeedback(requestId: string): Promise<MyFeedback | null> {
  if (!/^\d{1,15}$/.test(requestId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_feedback", { p_request_id: Number(requestId) });
  if (error) {
    console.error("[feedback] 만족도 읽기 실패", error.code, error.message);
    return null;
  }
  const row = (data as Row[])[0];
  return row ? { rating: row.rating, comment: row.comment?.trim() || undefined, updatedDate: seoulDateOf(row.updated_at) } : null;
}
