import { seoulDateOf } from "@/lib/date";
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
};

/** 모든 의뢰 — 최근에 받은 순 */
export async function getAllRequests(): Promise<AdminRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructor_requests")
    .select(
      "id, created_at, status, org_name, org_type, region, contact_name, contact_phone, contact_email, subject, schedule, target, headcount, budget, message",
    )
    .order("id", { ascending: false });
  if (error) throw new Error(`강사섭외 의뢰를 불러오지 못했습니다: ${error.message}`);

  return (data as Row[]).map((row) => ({
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
  }));
}

/** "01012345678" → "010-1234-5678", "0511234567" → "051-123-4567" (보기 좋게만. 저장은 숫자만) */
export function formatPhone(digits: string): string {
  if (digits.startsWith("02")) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  return digits.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}
