import { seoulDateOf } from "@/lib/date";
import { type MatchStatus, isMatchStatus } from "@/lib/match-status";
import type { RequestStatus } from "@/lib/request-status";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 내 의뢰. 담당자는 표를 직접 읽지 못하고, 데이터베이스 함수가 '자기가 낸 의뢰인지,
 * 운영자가 기관을 확인했는지'를 확인한 뒤 필요한 칸만 돌려준다 (supabase/request-portal.sql).
 * 강사 연락처는 운영자가 '확정'으로 바꾼 강사만 온다.
 */

export type MyRequest = {
  id: string;
  /** 보낸 날 (한국 날짜) */
  sentDate: string;
  status: RequestStatus;
  orgName: string;
  orgType: string;
  region: string;
  subject: string;
  schedule: string;
  target?: string;
  headcount?: number;
  budget?: string;
  message?: string;
  /** 운영자가 기관을 확인했다. 확인 전에는 추천 강사가 보이지 않는다 */
  verified: boolean;
  /** '다른 강사를 원해요'를 눌렀고 아직 새 강사가 추천되지 않았다 */
  moreRequested: boolean;
  moreNote?: string;
  matchCount: number;
  chosenCount: number;
  confirmedCount: number;
  /** 강사 모집 공고를 썼으면 그 상태 (검토 중 · 승인 · 반려). 안 썼으면 없음 */
  postingStatus?: "검토 중" | "승인" | "반려";
  /** 승인되어 올라간 공고 번호 */
  postingJobId?: string;
  /** 담당자가 모집을 마감했다 */
  postingClosed: boolean;
};

type RequestRow = {
  id: number;
  created_at: string;
  status: RequestStatus;
  org_name: string;
  org_type: string;
  region: string;
  subject: string;
  schedule: string;
  target: string | null;
  headcount: number | null;
  budget: string | null;
  message: string | null;
  verified: boolean;
  more_requested: boolean;
  more_note: string | null;
  match_count: number;
  chosen_count: number;
  confirmed_count: number;
  posting_status: string | null;
  posting_job_id: number | null;
  posting_closed: boolean;
};

/** 내가 보낸 의뢰 — 최근에 보낸 순 */
export async function getMyRequests(): Promise<MyRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_requests");
  if (error) throw new Error(`내 의뢰를 불러오지 못했습니다: ${error.message}`);
  return (data as RequestRow[]).map((r) => ({
    id: String(r.id),
    sentDate: seoulDateOf(r.created_at),
    status: r.status,
    orgName: r.org_name,
    orgType: r.org_type,
    region: r.region,
    subject: r.subject,
    schedule: r.schedule,
    target: r.target?.trim() || undefined,
    headcount: r.headcount ?? undefined,
    budget: r.budget?.trim() || undefined,
    message: r.message?.trim() || undefined,
    verified: r.verified,
    moreRequested: r.more_requested,
    moreNote: r.more_note?.trim() || undefined,
    matchCount: r.match_count,
    chosenCount: r.chosen_count,
    confirmedCount: r.confirmed_count,
    postingStatus:
      r.posting_status === "검토 중" || r.posting_status === "승인" || r.posting_status === "반려" ? r.posting_status : undefined,
    postingJobId: r.posting_job_id === null ? undefined : String(r.posting_job_id),
    postingClosed: r.posting_closed,
  }));
}

/** 내 의뢰 하나. 내 것이 아니면 null */
export async function getMyRequest(id: string): Promise<MyRequest | null> {
  if (!/^\d{1,15}$/.test(id)) return null;
  return (await getMyRequests()).find((r) => r.id === id) ?? null;
}

/** 추천 강사 한 명 (담당자에게 보이는 칸만) */
export type MyMatch = {
  id: string;
  status: MatchStatus;
  /** 내가 '이 강사님으로 할게요'를 눌렀다 */
  chosen: boolean;
  name: string;
  fields: string[];
  regions: string[];
  method: "form" | "file";
  career: string;
  certificates: string;
  intro: string;
  /** 강사가 올린 프로필 파일 이름 (파일로 낸 강사만) */
  fileName?: string;
  /** 운영자가 올린 강의계획서 이름 */
  planName?: string;
  /** 확정된 강사만 */
  phone?: string;
  email?: string;
  /** 강사가 공고에서 직접 지원했다 (아니면 운영자 추천) */
  applied: boolean;
  /** 지원하면서 남긴 한마디 */
  applyMessage?: string;
};

type MatchRow = {
  match_id: number;
  status: string;
  chosen: boolean;
  name: string;
  fields: string[] | null;
  regions: string[] | null;
  method: "form" | "file";
  career: string | null;
  certificates: string | null;
  intro: string | null;
  file_name: string | null;
  has_file: boolean;
  plan_name: string | null;
  has_plan: boolean;
  phone: string | null;
  email: string | null;
  applied: boolean;
  apply_message: string | null;
};

/** 내 의뢰의 추천 강사. 기관 확인 전이거나 내 의뢰가 아니면 빈 목록 */
export async function getMyRequestMatches(requestId: string): Promise<MyMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_request_matches", { p_request_id: Number(requestId) });
  if (error) throw new Error(`추천 강사를 불러오지 못했습니다: ${error.message}`);
  return (data as MatchRow[]).map((m) => ({
    id: String(m.match_id),
    status: isMatchStatus(m.status) ? m.status : "추천",
    chosen: m.chosen,
    name: m.name,
    fields: m.fields ?? [],
    regions: m.regions ?? [],
    method: m.method,
    career: m.career ?? "",
    certificates: m.certificates ?? "",
    intro: m.intro ?? "",
    fileName: m.has_file ? m.file_name || "프로필 파일" : undefined,
    planName: m.has_plan ? m.plan_name || "강의계획서" : undefined,
    phone: m.phone ?? undefined,
    email: m.email ?? undefined,
    applied: m.applied,
    applyMessage: m.apply_message?.trim() || undefined,
  }));
}
