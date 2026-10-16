"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { isMatchStatus } from "@/lib/match-status";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 강사섭외 의뢰에 추천 강사 붙이기 (의뢰 상세 화면 /admin/requests/의뢰번호 의 버튼들이 부른다).
 * 데이터베이스가 관리자인지 한 번 더 확인한다 (supabase/request-matching.sql).
 * 실패하면 같은 화면으로 돌아가 위쪽에 안내를 띄운다.
 */

const ID = /^\d{1,15}$/;
const MEMBER_ID = /^[0-9a-f-]{36}$/i;

function pagePath(requestId: string) {
  return `/admin/requests/${requestId}`;
}

/** 관리자가 아니거나 의뢰 번호가 이상하면 실패 안내로 돌려보낸다 */
async function guard(requestId: string, failed: string) {
  if (!ID.test(requestId)) redirect("/admin/requests?failed=1");
  if ((await getAdminStatus()) !== "admin") redirect(`${pagePath(requestId)}?failed=${failed}`);
}

function done(requestId: string) {
  revalidatePath(pagePath(requestId));
  revalidatePath("/admin/requests");
}

/** 기관 확인됨 표시 / 취소 */
export async function setRequestVerified(requestId: string, verified: boolean): Promise<void> {
  await guard(requestId, "verify");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_request_verified", { p_id: Number(requestId), p_verified: verified });
  if (error) {
    console.error("[admin] 기관 확인 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=verify`);
  }
  done(requestId);
}

/** 강사 프로필을 이 의뢰의 추천 강사로 붙인다. 이미 붙어 있으면 그대로 둔다. */
export async function addMatch(requestId: string, memberId: string): Promise<void> {
  await guard(requestId, "add");
  if (!MEMBER_ID.test(memberId)) redirect(`${pagePath(requestId)}?failed=add`);
  const supabase = await createClient();
  const { error } = await supabase.from("request_matches").insert({ request_id: Number(requestId), member_id: memberId });
  // 23505 = 이미 붙어 있음 (버튼을 두 번 눌렀을 때). 실패로 보지 않는다.
  if (error && error.code !== "23505") {
    console.error("[admin] 추천 강사 붙이기 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=add`);
  }
  done(requestId);
}

/** 추천 강사의 진행 상태 바꾸기 */
export async function setMatchStatus(requestId: string, matchId: string, status: string): Promise<void> {
  await guard(requestId, "status");
  if (!ID.test(matchId) || !isMatchStatus(status)) redirect(`${pagePath(requestId)}?failed=status`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("request_matches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", Number(matchId))
    .eq("request_id", Number(requestId));
  if (error) {
    console.error("[admin] 추천 강사 상태 바꾸기 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=status`);
  }
  done(requestId);
}

/** 추천 강사에서 빼기 (강사 프로필은 그대로) */
export async function removeMatch(requestId: string, matchId: string): Promise<void> {
  await guard(requestId, "remove");
  if (!ID.test(matchId)) redirect(`${pagePath(requestId)}?failed=remove`);
  const supabase = await createClient();
  const { error } = await supabase.from("request_matches").delete().eq("id", Number(matchId)).eq("request_id", Number(requestId));
  if (error) {
    console.error("[admin] 추천 강사 빼기 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=remove`);
  }
  done(requestId);
}
