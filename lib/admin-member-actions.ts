"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { MEMBER_TYPES, type MemberType } from "@/lib/auth-schema";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 회원 종류(강사 / 기관) 바꾸기. 가입할 때 잘못 고른 회원이 알려 오면 운영자가 바꾼다.
 * 데이터베이스가 관리자인지 한 번 더 확인한다 (supabase/member-type.sql 의 admin_set_member_type).
 * 실패하면 회원 목록 위쪽에 안내를 띄운다.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setMemberType(id: string, type: MemberType): Promise<void> {
  if ((await getAdminStatus()) !== "admin" || !UUID.test(id) || !MEMBER_TYPES.includes(type)) {
    redirect("/admin/members?failed=type");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_type", { p_id: id, p_type: type });
  if (error) {
    console.error("[admin] 회원 종류 바꾸기 실패", error.code, error.message);
    redirect("/admin/members?failed=type");
  }
  revalidatePath("/admin/members");
}
