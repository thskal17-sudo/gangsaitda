"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendKakaoToMe } from "@/lib/kakao";
import { getCurrentMember } from "@/lib/member";
import { getMyRequest } from "@/lib/my-requests";
import { postingSchema } from "@/lib/posting-schema";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 강사 모집 공고 쓰기·마감. 데이터베이스 함수가 '내 의뢰인지, 고칠 수 있는 상태인지'를 다시 확인한다
 * (supabase/request-postings.sql). 공고를 내면 운영자 카톡으로 검토 요청 알림이 간다 (실패해도 저장에는 영향 없음).
 */

const ID = /^\d{1,15}$/;

function pagePath(requestId: string) {
  return `/account/requests/${requestId}`;
}

/** 공고 저장 (처음 쓰기·반려 뒤 고치기). 저장하면 '검토 중'이 된다. 성공하면 의뢰 화면으로 돌아간다. */
export async function saveMyPosting(requestId: string, input: unknown): Promise<{ error: string } | undefined> {
  if (!ID.test(requestId)) return { error: "다시 시도해 주세요." };
  if (!(await getCurrentMember())) return { error: "로그인이 풀렸습니다. 다시 로그인한 뒤 저장해 주세요." };
  const parsed = postingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_my_posting", {
    p_request_id: Number(requestId),
    p_title: v.title,
    p_deadline: v.deadline,
    p_description: v.description,
    p_qualifications: v.qualifications || null,
    p_documents: v.documents || null,
  });
  if (error) {
    console.error("[my-posting] 모집 공고 저장 실패", error.code, error.message);
    return { error: error.code === "22023" ? error.message : "공고를 저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }

  // 알림 글은 지금(로그인 정보가 있을 때) 만들고, 보내기만 응답 뒤로 미룬다
  const request = await getMyRequest(requestId);
  const text = `[강사잇다] 기관이 모집 공고를 냈어요 (검토 요청)\n기관: ${request?.orgName ?? ""}\n제목: ${v.title}\n마감: ${v.deadline}`;
  after(() => sendKakaoToMe(text, `${SITE_URL}/admin/requests/${requestId}`, "공고 검토하기"));

  revalidatePath(pagePath(requestId));
  revalidatePath("/account/requests");
  redirect(`${pagePath(requestId)}?done=posting`);
}

/** 모집 마감: 올라간 공고를 내린다 */
export async function closeMyPosting(requestId: string): Promise<void> {
  if (!ID.test(requestId)) redirect("/account/requests");
  if (!(await getCurrentMember())) redirect(`/login?next=${encodeURIComponent(pagePath(requestId))}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_my_posting", { p_request_id: Number(requestId) });
  if (error) {
    console.error("[my-posting] 모집 마감 실패", error.code, error.message);
    redirect(`${pagePath(requestId)}?failed=close`);
  }
  revalidatePath(pagePath(requestId));
  revalidatePath("/account/requests");
  revalidatePath("/jobs");
  revalidatePath("/");
  redirect(`${pagePath(requestId)}?done=closed`);
}
