import type { MemberType } from "@/lib/auth-schema";
import { seoulDateOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 회원 목록. 회원 정보는 관리자만 전체를 읽을 수 있다 (supabase/admin-members.sql).
 * 고칠 수 있는 것은 회원 종류(강사 / 기관)뿐이다 (lib/admin-member-actions.ts).
 */

export type AdminMember = {
  id: string;
  name: string;
  /** 숫자만. 예: "01012345678" */
  phone: string;
  email: string;
  grade: string;
  type: MemberType;
  /** 기관 회원의 기관명 */
  orgName: string | null;
  /** 교육·강의 섭외 소식 문자 수신 동의한 날 (한국 날짜). 동의 안 했으면 null */
  smsDate: string | null;
  /** 가입한 날 (한국 날짜) */
  joinedDate: string;
};

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string;
  grade: string;
  member_type: string;
  org_name: string | null;
  sms_agreed_at: string | null;
  created_at: string;
};

/** 모든 회원 — 최근에 가입한 순 */
export async function getAllMembers(): Promise<AdminMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, phone, email, grade, member_type, org_name, sms_agreed_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`회원 목록을 불러오지 못했습니다: ${error.message}`);

  return (data as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    grade: row.grade,
    type: row.member_type === "기관" ? "기관" : "강사",
    orgName: row.org_name,
    smsDate: row.sms_agreed_at ? seoulDateOf(row.sms_agreed_at) : null,
    joinedDate: seoulDateOf(row.created_at),
  }));
}

/** 회원 목록 거르기 조건 (화면과 엑셀 내려받기가 함께 쓴다) */
export type MemberFilter = { q: string; smsOnly: boolean };

/** 주소의 ?q=…&sms=1 을 거르기 조건으로 */
export function parseMemberFilter(params: { q?: unknown; sms?: unknown }): MemberFilter {
  return {
    q: typeof params.q === "string" ? params.q.trim().slice(0, 50) : "",
    smsOnly: params.sms === "1",
  };
}

/** 이름·기관명·이메일·연락처로 찾고(연락처는 010-1234-5678 처럼 적어도 찾아짐), 문자 수신 동의만 거른다. */
export function filterMembers(members: AdminMember[], { q, smsOnly }: MemberFilter): AdminMember[] {
  const qLower = q.toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  return members.filter(
    (m) =>
      (!smsOnly || m.smsDate !== null) &&
      (!q ||
        m.name.toLowerCase().includes(qLower) ||
        m.email.toLowerCase().includes(qLower) ||
        (m.orgName ?? "").toLowerCase().includes(qLower) ||
        (qDigits.length >= 3 && m.phone.includes(qDigits))),
  );
}

/** 연락처를 엑셀에서도 0 이 사라지지 않게 하이픈을 넣어 적는다. 예: 01012345678 → 010-1234-5678 */
function phoneText(phone: string): string {
  if (/^02\d{7,8}$/.test(phone)) return phone.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  return phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}

/** CSV 한 칸. 쉼표·따옴표·줄바꿈을 감싸고, = + - @ 로 시작하면 엑셀이 수식으로 읽지 않게 앞에 ' 를 붙인다. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** 회원 목록을 엑셀에서 바로 열리는 CSV 로 (한글이 깨지지 않게 맨 앞에 BOM) */
export function membersCsv(members: AdminMember[]): string {
  const head = ["가입일", "종류", "이름", "기관명", "연락처", "이메일", "문자 수신 동의일", "등급"];
  const rows = members.map((m) => [
    m.joinedDate,
    m.type,
    m.name,
    m.orgName ?? "",
    phoneText(m.phone),
    m.email,
    m.smsDate ?? "",
    m.grade,
  ]);
  return "\uFEFF" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
