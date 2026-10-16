"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendKakaoToMe } from "@/lib/kakao";
import { getCurrentMember } from "@/lib/member";
import { getMyRequest, getMyRequestMatches } from "@/lib/my-requests";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 내 의뢰의 버튼들. 데이터베이스 함수가 '자기 의뢰인지, 기관 확인됐는지'를 다시 확인한다.
 * 누르면 운영자 카톡 '나와의 채팅'으로 알림이 간다 (실패해도 버튼 결과에는 영향 없음).
 * 끝나면 같은 화면으로 돌아가 위쪽에 결과를 띄운다 (?done=… 또는 ?failed=…).
 */

const ID = /^\d{1,15}$/;

function pagePath(requestId: string) {
  return `/account/requests/${requestId}`;
}

/** '이 강사님으로 할게요' / 취소 */
export async function chooseMatch(requestId: string, matchId: string, chosen: boolean): Promise<void> {
  if (!ID.test(requestId) || !ID.test(matchId)) redirect("/account/requests");
  if (!(await getCurrentMember())) redirect(`/login?next=${encodeURIComponent(pagePath(requestId))}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("choose_match", { p_match_id: Number(matchId), p_chosen: chosen });
  if (error) {
    console.error("[my-request] 강사 고르기 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=choose`);
  }

  if (chosen) {
    // 알림 글은 지금(로그인 정보가 있을 때) 만들고, 보내기만 응답 뒤로 미룬다
    const [request, matches] = await Promise.all([getMyRequest(requestId), getMyRequestMatches(requestId)]);
    const name = matches.find((m) => m.id === matchId)?.name ?? "";
    const text = `[강사잇다] 기관이 강사를 골랐어요\n기관: ${request?.orgName ?? ""}\n분야: ${request?.subject ?? ""}\n고른 강사: ${name}`;
    after(() => sendKakaoToMe(text, `${SITE_URL}/admin/requests/${requestId}`, "추천 강사 관리 열기"));
  }
  revalidatePath(pagePath(requestId));
  revalidatePath("/account/requests");
  redirect(`${pagePath(requestId)}?done=${chosen ? "chosen" : "unchosen"}`);
}

/** '다른 강사를 원해요' (한 줄 의견, 300자까지) */
export async function requestMore(requestId: string, formData: FormData): Promise<void> {
  if (!ID.test(requestId)) redirect("/account/requests");
  if (!(await getCurrentMember())) redirect(`/login?next=${encodeURIComponent(pagePath(requestId))}`);
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_more_instructors", { p_request_id: Number(requestId), p_note: note });
  if (error) {
    console.error("[my-request] 다른 강사 요청 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=more`);
  }

  const request = await getMyRequest(requestId);
  const text = `[강사잇다] 기관이 다른 강사를 원해요\n기관: ${request?.orgName ?? ""}\n분야: ${request?.subject ?? ""}${note ? `\n남긴 말: ${note}` : ""}`;
  after(() => sendKakaoToMe(text, `${SITE_URL}/admin/requests/${requestId}`, "추천 강사 관리 열기"));
  revalidatePath(pagePath(requestId));
  revalidatePath("/account/requests");
  redirect(`${pagePath(requestId)}?done=more`);
}
