"use server";

import { revalidatePath } from "next/cache";
import { getAdminStatus } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 강사 프로필 확인 배지 붙이기·떼기 (강사 프로필 화면과 의뢰 상세의 강사 줄이 부른다).
 * 데이터베이스가 관리자인지 한 번 더 확인하고, 확인한 때의 내용 지문을 적어 둔다 (supabase/profile-badges.sql).
 */

type Fail = { error: string };
const ID = /^[0-9a-f-]{36}$/i;

/** kind: profile = 프로필 확인, plan = 강의계획서 확인. checked 가 false 면 확인 취소 */
export async function setProfileCheck(
  id: string,
  kind: "profile" | "plan",
  checked: boolean,
  note?: string,
): Promise<{ ok: true } | Fail> {
  if ((await getAdminStatus()) !== "admin") return { error: "관리자만 할 수 있어요. 다시 로그인해 주세요." };
  if (!ID.test(id) || (kind !== "profile" && kind !== "plan")) return { error: "강사를 다시 골라 주세요." };
  const memo = String(note ?? "").trim();
  if (memo.length > 200) return { error: "메모는 200자까지 적을 수 있어요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_profile_check", {
    p_id: id,
    p_kind: kind,
    p_checked: checked,
    p_note: memo || null,
  });
  if (error) {
    console.error("[admin] 확인 배지 저장 실패", error.code, error.message);
    if (error.code === "22023" || error.code === "P0002") return { error: error.message };
    return { error: "저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  // 강사 프로필 화면과 의뢰 상세 화면이 함께 쓰므로 관리자 화면 전체를 새로 그린다.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
