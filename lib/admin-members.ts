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
  created_at: string;
};

/** 모든 회원 — 최근에 가입한 순 */
export async function getAllMembers(): Promise<AdminMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, phone, email, grade, member_type, org_name, created_at")
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
    joinedDate: seoulDateOf(row.created_at),
  }));
}
