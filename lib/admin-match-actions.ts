"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { isMatchStatus } from "@/lib/match-status";
import { REQUEST_FILES_BUCKET } from "@/lib/profile";
import { REQUEST_FILE_MAX_BYTES, planFolder, requestFileExtension } from "@/lib/request-files";
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

/** 추천 강사에서 빼기 (강사 프로필은 그대로, 올려 둔 강의계획서는 함께 지운다) */
export async function removeMatch(requestId: string, matchId: string): Promise<void> {
  await guard(requestId, "remove");
  if (!ID.test(matchId)) redirect(`${pagePath(requestId)}?failed=remove`);
  const supabase = await createClient();
  const before = await readPlanPath(requestId, matchId);
  const { error } = await supabase.from("request_matches").delete().eq("id", Number(matchId)).eq("request_id", Number(requestId));
  if (!error && before) await supabase.storage.from(REQUEST_FILES_BUCKET).remove([before]);
  if (error) {
    console.error("[admin] 추천 강사 빼기 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=remove`);
  }
  done(requestId);
}

/* ---- 강의계획서 (추천 강사마다 하나) --------------------------------------------------
 * 파일은 브라우저가 저장소에 바로 올린다 (사이트 서버를 거치면 큰 파일이 막히므로).
 * 순서: preparePlanUpload 로 '올릴 자리'를 받음 → 브라우저가 올림 → savePlan 으로 표에 적음(전 파일은 지움).
 */

type Fail = { error: string };
const NOT_ADMIN: Fail = { error: "관리자만 할 수 있어요. 다시 로그인해 주세요." };

async function readPlanPath(requestId: string, matchId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_matches")
    .select("plan_path")
    .eq("id", Number(matchId))
    .eq("request_id", Number(requestId))
    .maybeSingle();
  return (data as { plan_path: string | null } | null)?.plan_path ?? null;
}

export async function preparePlanUpload(
  requestId: string,
  matchId: string,
  fileName: unknown,
  size: unknown,
): Promise<{ path: string; signedUrl: string } | Fail> {
  if ((await getAdminStatus()) !== "admin" || !ID.test(requestId) || !ID.test(matchId)) return NOT_ADMIN;
  if (typeof fileName !== "string" || typeof size !== "number") return { error: "파일을 다시 골라 주세요." };
  const ext = requestFileExtension(fileName);
  if (!ext) return { error: "PDF, 한글, 워드, 파워포인트, 사진(JPG·PNG) 파일만 올릴 수 있어요." };
  if (size <= 0 || size > REQUEST_FILE_MAX_BYTES) return { error: "파일은 10MB 까지 올릴 수 있어요." };

  const path = `${planFolder(requestId, matchId)}${Date.now()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(REQUEST_FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[admin] 강의계획서 올릴 자리 만들기 실패", error?.message);
    return { error: "파일을 올릴 준비를 하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { path, signedUrl: data.signedUrl };
}

/** 방금 올린 강의계획서를 추천 강사 줄에 적는다. 전에 올린 파일이 있으면 지운다. */
export async function savePlan(requestId: string, matchId: string, path: unknown, fileName: unknown): Promise<{ ok: true } | Fail> {
  if ((await getAdminStatus()) !== "admin" || !ID.test(requestId) || !ID.test(matchId)) return NOT_ADMIN;
  if (typeof path !== "string" || !path.startsWith(planFolder(requestId, matchId)) || path.includes("..")) {
    return { error: "파일을 다시 올려 주세요." };
  }
  const name = String(fileName ?? "").slice(0, 200) || "강의계획서";

  const supabase = await createClient();
  const before = await readPlanPath(requestId, matchId);
  const { error } = await supabase
    .from("request_matches")
    .update({ plan_path: path, plan_name: name })
    .eq("id", Number(matchId))
    .eq("request_id", Number(requestId));
  if (error) {
    console.error("[admin] 강의계획서 저장 실패", error.code, error.message);
    await supabase.storage.from(REQUEST_FILES_BUCKET).remove([path]);
    return { error: "강의계획서를 저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  if (before && before !== path) await supabase.storage.from(REQUEST_FILES_BUCKET).remove([before]);
  done(requestId);
  return { ok: true };
}

/** 강의계획서 지우기 */
export async function removePlan(requestId: string, matchId: string): Promise<void> {
  await guard(requestId, "plan");
  if (!ID.test(matchId)) redirect(`${pagePath(requestId)}?failed=plan`);
  const supabase = await createClient();
  const before = await readPlanPath(requestId, matchId);
  const { error } = await supabase
    .from("request_matches")
    .update({ plan_path: null, plan_name: null })
    .eq("id", Number(matchId))
    .eq("request_id", Number(requestId));
  if (error) {
    console.error("[admin] 강의계획서 지우기 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=plan`);
  }
  if (before) await supabase.storage.from(REQUEST_FILES_BUCKET).remove([before]);
  done(requestId);
}
