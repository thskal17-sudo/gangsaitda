"use server";

import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { disconnectKakao, sendKakaoToMe } from "@/lib/kakao";
import { SITE_URL } from "@/lib/site";

/* 관리자 · 카톡 알림 화면의 버튼들. 결과는 주소 끝(?sent=1 등)으로 알려 화면이 안내를 띄운다. */

export async function sendKakaoTest(): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/kakao?failed=admin");
  const ok = await sendKakaoToMe(
    "[강사잇다] 시험 메시지예요.\n이 메시지가 보이면 카톡 알림 연결이 잘 된 거예요.",
    `${SITE_URL}/admin/requests`,
  );
  redirect(ok ? "/admin/kakao?sent=1" : "/admin/kakao?failed=send");
}

export async function disconnectKakaoAction(): Promise<void> {
  if ((await getAdminStatus()) !== "admin") redirect("/admin/kakao?failed=admin");
  try {
    await disconnectKakao();
  } catch (err) {
    console.error("[kakao] 연결 끊기 실패", err);
    redirect("/admin/kakao?failed=disconnect");
  }
  redirect("/admin/kakao?disconnected=1");
}
