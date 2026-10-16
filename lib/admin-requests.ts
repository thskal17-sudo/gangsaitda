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
  /** 담당자가 '다른 강사를 원해요'를 눌렀고, 아직 새 강사를 추천하지 않았다 */
  moreRequested: boolean;
  /** '다른 강사를 원해요'와 함께 남긴 한 줄 (새 추천 뒤에도 남는다) */
  moreNote?: string;
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
  more_requested_at: string | null;
  more_note: string | null;
};

const REQUEST_COLUMNS =
  "id, created_at, status, org_name, org_type, region, contact_name, contact_phone, contact_email, subject, schedule, target, headcount, budget, message, org_verified_at, more_requested_at, more_note";

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
    moreRequested: Boolean(row.more_requested_at),
    moreNote: row.more_note?.trim() || undefined,
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
  /** 추천한 강사: 가입 강사는 회원번호, 운영자 등록 강사는 등록번호 (lib/admin-profiles.ts 의 memberId 와 같은 값) */
  memberId: string;
  status: MatchStatus;
  /** 상태를 마지막으로 바꾼 날 (한국 날짜) */
  updatedDate: string;
  /** 기관 담당자가 '이 강사님으로 할게요'를 눌렀다 */
  chosen: boolean;
  /** 운영자가 올린 강의계획서 원래 이름. 없으면 없음 */
  planName?: string;
};

type MatchRow = {
  id: number;
  request_id: number;
  member_id: string | null;
  instructor_id: string | null;
  status: string;
  updated_at: string;
  org_chosen_at: string | null;
  plan_path: string | null;
  plan_name: string | null;
};

/** 의뢰 하나의 추천 강사 — 먼저 붙인 순 */
export async function getMatches(requestId: string): Promise<AdminMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("request_matches")
    .select("id, request_id, member_id, instructor_id, status, updated_at, org_chosen_at, plan_path, plan_name")
    .eq("request_id", Number(requestId))
    .order("id");
  if (error) throw new Error(`추천 강사를 불러오지 못했습니다: ${error.message}`);
  return (data as MatchRow[]).map((m) => ({
    id: String(m.id),
    memberId: m.member_id ?? m.instructor_id ?? "",
    status: isMatchStatus(m.status) ? m.status : "추천",
    updatedDate: seoulDateOf(m.updated_at),
    chosen: Boolean(m.org_chosen_at),
    planName: m.plan_path ? m.plan_name || "강의계획서" : undefined,
  }));
}

/** 의뢰 번호 → 추천 강사 수 (목록 카드에 '추천 3명 · 확정 1명'으로 보여 준다) */
export async function getMatchCounts(): Promise<Map<string, { total: number; confirmed: number; chosen: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("request_matches").select("request_id, status, org_chosen_at");
  if (error) throw new Error(`추천 강사를 불러오지 못했습니다: ${error.message}`);
  const counts = new Map<string, { total: number; confirmed: number; chosen: number }>();
  for (const m of data as Pick<MatchRow, "request_id" | "status" | "org_chosen_at">[]) {
    const key = String(m.request_id);
    const c = counts.get(key) ?? { total: 0, confirmed: 0, chosen: 0 };
    c.total += 1;
    if (m.status === "확정") c.confirmed += 1;
    if (m.org_chosen_at) c.chosen += 1;
    counts.set(key, c);
  }
  return counts;
}

/** "01012345678" → "010-1234-5678", "0511234567" → "051-123-4567" (보기 좋게만. 저장은 숫자만) */
export function formatPhone(digits: string): string {
  if (digits.startsWith("02")) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  return digits.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}

/** 강의계획서를 잠깐(1분)만 열리는 주소로. 내려받을 때 '강사이름_원래이름'. 관리자가 아니면 저장소가 내주지 않아 null. */
export async function getPlanFileUrl(requestId: string, matchId: string): Promise<string | null> {
  if (!/^\d{1,15}$/.test(requestId) || !/^\d{1,15}$/.test(matchId)) return null;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("request_matches")
    .select("plan_path, plan_name, member_id, instructor_id")
    .eq("id", Number(matchId))
    .eq("request_id", Number(requestId))
    .maybeSingle();
  const r = row as { plan_path: string | null; plan_name: string | null; member_id: string | null; instructor_id: string | null } | null;
  if (!r?.plan_path) return null;
  const { data: member } = r.member_id
    ? await supabase.from("members").select("name").eq("id", r.member_id).maybeSingle()
    : await supabase.from("admin_instructors").select("name").eq("id", r.instructor_id ?? "").maybeSingle();
  const { data, error } = await supabase.storage.from("request-files").createSignedUrl(r.plan_path, 60);
  if (error || !data) {
    console.error("[admin] 강의계획서 주소 만들기 실패", error?.message);
    return null;
  }
  const downloadName = `${(member as { name: string } | null)?.name ?? "강사"}_${r.plan_name ?? "강의계획서"}`;
  return `${data.signedUrl}&download=${encodeURIComponent(downloadName)}`;
}
