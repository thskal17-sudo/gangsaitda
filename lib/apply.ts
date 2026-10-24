import { seoulDateOf } from "@/lib/date";
import { type MatchStatus, isMatchStatus } from "@/lib/match-status";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사 회원 · 내가 이 공고에 지원했는지. 데이터베이스 함수(my_application, supabase/job-apply.sql)가
 * 로그인한 회원 것만 돌려준다. 지원하기는 lib/apply-actions.ts.
 */

export type MyApplication = {
  matchId: string;
  /** 지원한 날 (한국 날짜) */
  appliedDate: string;
  status: MatchStatus;
};

type Row = { match_id: number; applied_at: string; status: string };

/** 이 공고에 낸 내 지원. 안 냈으면 null */
export async function getMyApplication(jobId: string): Promise<MyApplication | null> {
  if (!/^\d{1,15}$/.test(jobId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_application", { p_job_id: Number(jobId) });
  if (error) {
    console.error("[apply] 내 지원 읽기 실패", error.code, error.message);
    return null;
  }
  const row = (data as Row[])[0];
  return row
    ? { matchId: String(row.match_id), appliedDate: seoulDateOf(row.applied_at), status: isMatchStatus(row.status) ? row.status : "지원" }
    : null;
}
