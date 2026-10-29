"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 기관이 낸 강사 모집 공고 승인 / 반려. 데이터베이스 함수 admin_review_posting 이 관리자인지,
 * 기관 확인이 됐는지 한 번 더 확인한다 (supabase/request-postings.sql).
 * 승인하면 공고 표에 들어가 공고 목록에 바로 보인다. 끝나면 의뢰 상세 화면으로 돌아간다.
 */

const ID = /^\d{1,15}$/;

export async function reviewPosting(requestId: string, approve: boolean, formData: FormData): Promise<void> {
  if (!ID.test(requestId)) redirect("/admin/requests?failed=1");
  const page = `/admin/requests/${requestId}`;
  if ((await getAdminStatus()) !== "admin") redirect(`${page}?failed=review`);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!approve && !note) redirect(`${page}?failed=note`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_posting", { p_request_id: Number(requestId), p_approve: approve, p_note: approve ? null : note });
  if (error) {
    console.error("[admin] 모집 공고 검토 실패", error.code, error.message);
    redirect(`${page}?failed=${error.code === "22023" ? "unverified" : "review"}`);
  }

  revalidatePath(page);
  revalidatePath("/admin/requests");
  if (approve) {
    revalidatePath("/jobs");
    revalidatePath("/");
    revalidatePath("/admin/jobs");
  }
  redirect(`${page}?done=${approve ? `approved&job=${data ?? ""}` : "rejected"}`);
}
