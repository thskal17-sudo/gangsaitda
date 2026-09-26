"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { isRequestStatus } from "@/lib/request-status";
import { createClient } from "@/lib/supabase/server";

/**
 * 강사섭외 의뢰의 처리 상태 바꾸기 (접수 / 처리 중 / 완료). 의뢰 목록의 상태 버튼(form)이 부른다.
 * 데이터베이스 함수 admin_set_request_status 가 관리자인지 한 번 더 확인한다.
 */
export async function setRequestStatus(id: string, status: string): Promise<void> {
  if ((await getAdminStatus()) !== "admin" || !/^\d{1,15}$/.test(id) || !isRequestStatus(status)) {
    redirect("/admin/requests?failed=1");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_request_status", { p_id: Number(id), p_status: status });
  if (error) {
    console.error("[admin] 의뢰 상태 바꾸기 실패", error.code, error.message);
    redirect("/admin/requests?failed=1");
  }

  revalidatePath("/admin/requests");
}
