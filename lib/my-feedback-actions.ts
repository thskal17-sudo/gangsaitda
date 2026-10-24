"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendKakaoToMe } from "@/lib/kakao";
import { getCurrentMember } from "@/lib/member";
import { getMyRequest } from "@/lib/my-requests";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 강의 만족도 남기기·고치기. 데이터베이스 함수 save_my_feedback 이 '내 의뢰인지, 완료됐는지'를 다시 확인한다
 * (supabase/request-feedback.sql). 남기면 운영자 카톡으로 알림이 간다. 끝나면 같은 화면으로 돌아간다.
 */

const ID = /^\d{1,15}$/;

export async function saveMyFeedback(requestId: string, formData: FormData): Promise<void> {
  if (!ID.test(requestId)) redirect("/account/requests");
  const page = `/account/requests/${requestId}`;
  if (!(await getCurrentMember())) redirect(`/login?next=${encodeURIComponent(page)}`);

  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 300);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) redirect(`${page}?failed=feedback`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_my_feedback", { p_request_id: Number(requestId), p_rating: rating, p_comment: comment || null });
  if (error) {
    console.error("[feedback] 만족도 저장 실패", error.code, error.message);
    redirect(`${page}?failed=feedback`);
  }

  const request = await getMyRequest(requestId);
  const text = `[강사잇다] 기관이 만족도를 남겼어요\n기관: ${request?.orgName ?? ""}\n분야: ${request?.subject ?? ""}\n별점: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}${comment ? `\n의견: ${comment}` : ""}`;
  after(() => sendKakaoToMe(text, `${SITE_URL}/admin/requests/${requestId}`, "의뢰 보기"));

  revalidatePath(page);
  revalidatePath("/account/requests");
  redirect(`${page}?done=feedback`);
}
