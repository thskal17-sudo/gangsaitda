"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/admin";
import { type JobInput, jobSchema, newJobSchema } from "@/lib/admin-job-schema";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 공고 올리기·고치기·숨기기.
 * 데이터베이스 함수가 관리자인지 한 번 더 확인한다 (supabase/admin-job-create.sql, admin-job-edit.sql).
 */

const NOT_ADMIN = "관리자만 할 수 있습니다. 다시 로그인해 주세요.";

/** 입력값을 데이터베이스 함수의 칸 이름으로 바꾼다. 빈칸은 '없음(null)'으로. */
function toRpcArgs(v: JobInput) {
  const blankToNull = (value: string) => (value === "" ? null : value);
  return {
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
  };
}

/** 새 공고·바뀐 공고가 홈·공고 목록·관리자 목록에 바로 반영되게 한다. */
function refreshSite() {
  revalidatePath("/", "layout");
}

export async function createJob(input: unknown): Promise<{ id: string } | { error: string }> {
  if ((await getAdminStatus()) !== "admin") return { error: NOT_ADMIN };

  const parsed = newJobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_job", toRpcArgs(parsed.data));
  if (error) {
    console.error("[admin] 공고 저장 실패", error.code, error.message);
    return { error: "공고를 저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  refreshSite();
  return { id: String(data) };
}

export async function updateJob(id: string, input: unknown): Promise<{ id: string } | { error: string }> {
  if ((await getAdminStatus()) !== "admin") return { error: NOT_ADMIN };
  if (!/^\d{1,15}$/.test(id)) return { error: "없는 공고입니다." };

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_job", { p_id: Number(id), ...toRpcArgs(parsed.data) });
  if (error) {
    console.error("[admin] 공고 수정 실패", error.code, error.message);
    return {
      error: error.code === "P0002" ? "없는 공고입니다. 목록에서 다시 골라 주세요." : "공고를 고치지 못했습니다. 잠시 뒤에 다시 시도해 주세요.",
    };
  }

  refreshSite();
  return { id };
}

/**
 * 숨기기 / 다시 올리기. 공고 관리 목록의 버튼(form)이 부른다.
 * 성공하면 보던 목록이 그대로 새로 그려지고, 실패하면 목록 위에 안내를 띄운다.
 */
export async function setJobHidden(id: string, hidden: boolean): Promise<void> {
  if ((await getAdminStatus()) !== "admin" || !/^\d{1,15}$/.test(id)) redirect("/admin?failed=hide");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_job_hidden", { p_id: Number(id), p_hidden: hidden });
  if (error) {
    console.error("[admin] 숨기기 실패", error.code, error.message);
    redirect("/admin?failed=hide");
  }

  refreshSite();
}
