"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendKakaoToMe } from "@/lib/kakao";
import { getCurrentMember } from "@/lib/member";
import { getMyMatchFeedbacks } from "@/lib/my-feedback";
import { getMyRequest } from "@/lib/my-requests";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 확정된 강사의 강의 만족도 남기기·고치기. 데이터베이스 함수 save_match_feedback 이
 * '내 의뢰의 확정된 강사인지'를 다시 확인한다 (supabase/match-feedback.sql). 남기면 운영자 카톡으로 알림이 간다.
 * 끝나면 같은 화면으로 돌아간다.
 */

const ID = /^\d{1,15}$/;

export async function saveMatchFeedback(requestId: string, matchId: string, formData: FormData): Promise<void> {
  if (!ID.test(requestId) || !ID.test(matchId)) redirect("/account/requests");
  const page = `/account/requests/${requestId}`;
  if (!(await getCurrentMember())) redirect(`/login?next=${encodeURIComponent(page)}`);

  const rating = Number(formData.get("rating"));
  const rehireValue = formData.get("rehire");
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 300);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) redirect(`${page}?failed=feedback`);
  if (rehireValue !== "yes" && rehireValue !== "no") redirect(`${page}?failed=feedback`);
  const rehire = rehireValue === "yes";

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_match_feedback", {
    p_match_id: Number(matchId),
    p_rating: rating,
    p_rehire: rehire,
    p_comment: comment || null,
  });
  if (error) {
    console.error("[feedback] 만족도 저장 실패", error.code, error.message);
    redirect(`${page}?failed=feedback`);
  }

  const [request, feedbacks] = await Promise.all([getMyRequest(requestId), getMyMatchFeedbacks(requestId)]);
  const name = feedbacks.find((f) => f.matchId === matchId)?.name ?? "";
  const text =
    `[강사잇다] 기관이 만족도를 남겼어요\n기관: ${request?.orgName ?? ""}\n분야: ${request?.subject ?? ""}\n강사: ${name}` +
    `\n별점: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}\n다시 부르고 싶어요: ${rehire ? "예" : "아니요"}${comment ? `\n의견: ${comment}` : ""}`;
  after(() => sendKakaoToMe(text, `${SITE_URL}/admin/requests/${requestId}`, "의뢰 보기"));

  revalidatePath(page);
  revalidatePath("/account/requests");
  redirect(`${page}?done=feedback`);
}
