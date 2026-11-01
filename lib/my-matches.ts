import { seoulDateOf } from "@/lib/date";
import { type MatchStatus, isMatchStatus } from "@/lib/match-status";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사 회원 · 내 지원 현황. 내가 공고에서 직접 지원한 것과 운영자가 나를 추천한 의뢰를 한곳에.
 * 강사는 추천 강사 표를 직접 읽지 못하고, 데이터베이스 함수(my_matches, supabase/my-matches.sql)가
 * 본인 줄만 필요한 칸만 돌려준다. 추천은 운영자가 기관을 확인한 의뢰만, 추천 기관명은 확정 뒤에만 온다.
 */

export type MyMatch = {
  id: string;
  /** true: 공고에서 직접 지원 / false: 운영자가 추천 */
  applied: boolean;
  status: MatchStatus;
  /** 지원한 날 또는 추천된 날 (한국 날짜) */
  startedDate: string;
  /** 상태가 마지막으로 바뀐 날 (한국 날짜) */
  updatedDate: string;
  /** 의뢰가 끝났다 (운영자가 '완료'로 바꿈) */
  requestDone: boolean;
  subject: string;
  orgType: string;
  /** 추천은 확정 뒤에만 있음 */
  orgName?: string;
  region: string;
  schedule: string;
  jobId?: string;
  jobTitle?: string;
};

type Row = {
  match_id: number;
  applied: boolean;
  status: string;
  started_at: string;
  updated_at: string;
  request_status: string;
  subject: string;
  org_type: string;
  org_name: string | null;
  region: string;
  schedule: string;
  job_id: number | null;
  job_title: string | null;
};

/** 결과가 나온 상태 (확정·불발). 나머지는 진행 중 */
export function isFinished(m: MyMatch): boolean {
  return m.status === "확정" || m.status === "불발";
}

/** 내 지원·추천 — 최근 순. 함수가 아직 없으면(SQL 실행 전) null */
export async function getMyMatches(): Promise<MyMatch[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_matches");
  if (error) {
    console.error("[my-matches] 내 지원 현황 읽기 실패", error.code, error.message);
    return null;
  }
  return (data as Row[]).map((r) => ({
    id: String(r.match_id),
    applied: r.applied,
    status: isMatchStatus(r.status) ? r.status : r.applied ? "지원" : "추천",
    startedDate: seoulDateOf(r.started_at),
    updatedDate: seoulDateOf(r.updated_at),
    requestDone: r.request_status === "완료",
    subject: r.subject,
    orgType: r.org_type,
    orgName: r.org_name ?? undefined,
    region: r.region,
    schedule: r.schedule,
    jobId: r.job_id === null ? undefined : String(r.job_id),
    jobTitle: r.job_title ?? undefined,
  }));
}
