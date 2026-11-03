"use server";

import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import {
  checkThreadsConnection,
  cleanDraftBody,
  disconnectThreads,
  discardThreadsDraft,
  postThreadsDraft,
  retryFailedThreadsPosts,
  saveThreadsAppKeys,
} from "@/lib/threads";

/* 관리자 · Threads 자동 게시 화면의 버튼들. 결과는 주소 끝(?checked=1 등)으로 알려 화면이 안내를 띄운다. */

/** 연결 확인: Threads 에 계정 정보를 물어본다. 글은 올리지 않는다. */
export async function checkThreadsAction(): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/threads?failed=admin");
  const result = await checkThreadsConnection();
  redirect(result.ok ? "/admin/threads?checked=1" : "/admin/threads?failed=check");
}

export async function disconnectThreadsAction(): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/threads?failed=admin");
  try {
    await disconnectThreads();
  } catch (err) {
    console.error("[threads] 연결 끊기 실패", err);
    redirect("/admin/threads?failed=disconnect");
  }
  redirect("/admin/threads?disconnected=1");
}

/** Threads 앱 ID: 숫자만 (Meta 화면의 'Threads 앱 ID') */
const APP_ID = /^\d{5,30}$/;
/** Threads 앱 시크릿: 영문·숫자 (Meta 화면의 'Threads 앱 시크릿 코드') */
const APP_SECRET = /^[A-Za-z0-9]{16,128}$/;

/**
 * Threads 앱 ID·시크릿 저장 (관리자 화면의 입력 칸). 사이트 환경 변수를 고칠 수 없을 때를 위한 길.
 * 시크릿은 저장만 하고 화면에 다시 보여주지 않는다.
 */
export async function saveThreadsKeysAction(formData: FormData): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/threads?failed=admin");
  const appId = String(formData.get("appId") ?? "").replace(/\s+/g, "");
  const appSecret = String(formData.get("appSecret") ?? "").replace(/\s+/g, "");
  if (!APP_ID.test(appId)) redirect("/admin/threads?failed=appid");
  if (!APP_SECRET.test(appSecret)) redirect("/admin/threads?failed=secret");
  try {
    await saveThreadsAppKeys(appId, appSecret);
  } catch (err) {
    console.error("[threads] 앱 열쇠 저장 실패", err instanceof Error ? err.message : err);
    redirect("/admin/threads?failed=savekeys");
  }
  redirect("/admin/threads?keys=1");
}

/** 실패한 공고 다시 올리기 (관리자 화면 버튼). 결과 수를 주소 끝에 붙여 화면이 안내를 띄운다. */
export async function retryFailedThreadsAction(): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/threads?failed=admin");
  const result = await retryFailedThreadsPosts();
  if (result.error) redirect("/admin/threads?failed=retry");
  redirect(`/admin/threads?retried=${result.posted}&of=${result.failed}`);
}

/** 올릴 글 번호 (폼의 숨은 칸) */
function draftId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** 올릴 글 · [올리기]. 칸에서 고친 글 그대로 Threads 에 올린다. */
export async function postThreadsDraftAction(formData: FormData): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/threads?failed=admin");
  const id = draftId(formData);
  const body = cleanDraftBody(formData.get("body"));
  if (id === null) redirect("/admin/threads?failed=draft");
  if (body === null) redirect("/admin/threads?failed=draftlength");
  const result = await postThreadsDraft(id, body);
  if (!result.ok) redirect(`/admin/threads?failed=draftpost&why=${encodeURIComponent(result.error.slice(0, 160))}`);
  redirect("/admin/threads?draftPosted=1");
}

/** 올릴 글 · [버리기]. 올리지 않고 목록에서 치운다. */
export async function discardThreadsDraftAction(formData: FormData): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/threads?failed=admin");
  const id = draftId(formData);
  if (id === null) redirect("/admin/threads?failed=draft");
  try {
    await discardThreadsDraft(id);
  } catch (err) {
    console.error("[threads] 올릴 글 버리기 실패", err instanceof Error ? err.message : err);
    redirect("/admin/threads?failed=draft");
  }
  redirect("/admin/threads?draftDiscarded=1");
}
