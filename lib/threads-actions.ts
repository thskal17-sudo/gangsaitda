"use server";

import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { checkThreadsConnection, disconnectThreads, saveThreadsAppKeys } from "@/lib/threads";

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
