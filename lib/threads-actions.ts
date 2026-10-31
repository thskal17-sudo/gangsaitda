"use server";

import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { checkThreadsConnection, disconnectThreads } from "@/lib/threads";

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
