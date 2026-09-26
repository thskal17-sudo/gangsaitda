"use server";

import { revalidatePath } from "next/cache";
import { getAdminStatus } from "@/lib/admin";
import { jobSchema } from "@/lib/admin-job-schema";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 공고 올리기. 데이터베이스 함수 admin_create_job 이 관리자인지 한 번 더 확인하고,
 * 제목과 상세를 한꺼번에 저장한다 (supabase/admin-job-create.sql).
 */
export async function createJob(input: unknown): Promise<{ id: string } | { error: string }> {
  if ((await getAdminStatus()) !== "admin") return { error: "관리자만 공고를 올릴 수 있습니다. 다시 로그인해 주세요." };

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const blankToNull = (value: string) => (value === "" ? null : value);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_job", {
    p_title: v.title,
    p_organization: v.organization,
    p_region: v.region,
    p_deadline: v.deadline,
    p_schedule: v.schedule,
    p_description: v.description,
    p_target: blankToNull(v.target),
    p_headcount: v.headcount === "" ? null : Number(v.headcount),
    p_qualifications: blankToNull(v.qualifications),
    p_documents: blankToNull(v.documents),
    p_source_url: blankToNull(v.sourceUrl),
    p_apply_url: blankToNull(v.applyUrl),
    p_apply_email: blankToNull(v.applyEmail),
  });

  if (error) {
    console.error("[admin] 공고 저장 실패", error.code, error.message);
    return { error: "공고를 저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  // 새 공고가 홈·공고 목록·관리자 목록에 바로 보이게 한다.
  revalidatePath("/", "layout");
  return { id: String(data) };
}
