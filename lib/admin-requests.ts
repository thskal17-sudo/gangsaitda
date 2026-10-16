import { seoulDateOf } from "@/lib/date";
import { type MatchStatus, isMatchStatus } from "@/lib/match-status";
import type { RequestStatus } from "@/lib/request-status";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 강사섭외 의뢰. 의뢰에는 담당자 연락처가 있어 관리자만 읽을 수 있다
 * (supabase/admin-requests.sql — 일반 회원이 읽으면 데이터베이스가 0줄을 준다).
 */

export type AdminRequest = {
  id: string;
  /** 받은 날 (한국 날짜) */
  receivedDate: string;
  status: RequestStatus;
  orgName: string;
  orgType: string;
  region: string;
  contactName: string;
  /** 숫자만. 예: "01012345678" */
  contactPhone: string;
  contactEmail: string;
  subject: string;
  schedule: string;
  target?: string;
  headcount?: number;
  budget?: string;
  message?: string;
  /** 운영자가 기관을 확인한 날 (한국 날짜). 확인 전이면 없음 */
  verifiedDate?: string;
};

type Row = {
  id: number;
  created_at: string;
  status: RequestStatus;
  org_name: string;
  org_type: string;
  region: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  subject: string;
  schedule: string;
  target: string | null;
  headcount: number | null;
  budget: string | null;
  message: string | null;
  org_verified_at: string | null;
};

const REQUEST_COLUMNS =
  "id, created_at, status, org_name, org_type, region, contact_name, contact_phone, contact_email, subject, schedule, target, headcount, budget, message, org_verified_at";

function toRequest(row: Row): AdminRequest {
  return {
    id: String(row.id),
    receivedDate: seoulDateOf(row.created_at),
    status: row.status,
    orgName: row.org_name,
    orgType: row.org_type,
    region: row.region,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    subject: row.subject,
    schedule: row.schedule,
    target: row.target?.trim() || undefined,
    headcount: row.headcount ?? undefined,
    budget: row.budget?.trim() || undefined,
    message: row.message?.trim() || undefined,
    verifiedDate: row.org_verified_at ? seoulDateOf(row.org_verified_at) : undefined,
  };
}

/** 모든 의뢰 — 최근에 받은 순 */
export async function getAllRequests(): Promise<AdminRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("instructor_requests").select(REQUEST_COLUMNS).order("id", { ascending: false });
  if (error) throw new Error(`강사섭외 의뢰를 불러오지 못했습니다: ${error.message}`);
  return (data as Row[]).map(toRequest);
}

/** 의뢰 하나. 없거나 번호가 이상하면 null */
export async function getRequest(id: string): Promise<AdminRequest | null> {
  if (!/^\d{1,15}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("instructor_requests").select(REQUEST_COLUMNS).eq("id", Number(id)).maybeSingle();
  if (error) throw new Error(`강사섭외 의뢰를 불러오지 못했습니다: ${error.message}`);
  return data ? toRequest(data as Row) : null;
}

/** 의뢰에 붙인 추천 강사 한 명 */
export type AdminMatch = {
  id: string;
  memberId: string;
  status: MatchStatus;
  /** 상태를 마지막으로 바꾼 날 (한국 날짜) */
  updatedDate: string;
};

type MatchRow = { id: number; request_id: number; member_id: string; status: string; updated_at: string };

/** 의뢰 하나의 추천 강사 — 먼저 붙인 순 */
export async function getMatches(requestId: string): Promise<AdminMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("request_matches")
    .select("id, request_id, member_id, status, updated_at")
    .eq("request_id", Number(requestId))
    .order("id");
  if (error) throw new Error(`추천 강사를 불러오지 못했습니다: ${error.message}`);
  return (data as MatchRow[]).map((m) => ({
    id: String(m.id),
    memberId: m.member_id,
    status: isMatchStatus(m.status) ? m.status : "추천",
    updatedDate: seoulDateOf(m.updated_at),
  }));
}

/** 의뢰 번호 → 추천 강사 수 (목록 카드에 '추천 3명 · 확정 1명'으로 보여 준다) */
export async function getMatchCounts(): Promise<Map<string, { total: number; confirmed: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("request_matches").select("request_id, status");
  if (error) throw new Error(`추천 강사를 불러오지 못했습니다: ${error.message}`);
  const counts = new Map<string, { total: number; confirmed: number }>();
  for (const m of data as Pick<MatchRow, "request_id" | "status">[]) {
    const key = String(m.request_id);
    const c = counts.get(key) ?? { total: 0, confirmed: 0 };
    c.total += 1;
    if (m.status === "확정") c.confirmed += 1;
    counts.set(key, c);
  }
  return counts;
}

/** "01012345678" → "010-1234-5678", "0511234567" → "051-123-4567" (보기 좋게만. 저장은 숫자만) */
export function formatPhone(digits: string): string {
  if (digits.startsWith("02")) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  return digits.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}
