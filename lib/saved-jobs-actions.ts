"use server";

import { refresh } from "next/cache";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사 회원 · 관심 공고 담기/빼기, '지원했어요' 표시/취소 (supabase/saved-jobs.sql).
 * 표의 규칙이 '본인 줄만, 담기는 강사 회원만'을 한 번 더 확인한다.
 */

type Result = { ok: true } | { error: string };
const ID = /^\d{1,15}$/;

async function check(jobId: string): Promise<Result | null> {
  if (!ID.test(jobId)) return { error: "다시 시도해 주세요." };
  if (!(await getCurrentMember())) return { error: "로그인이 풀렸습니다. 다시 로그인해 주세요." };
  if ((await getMemberType()) === "기관") return { error: "강사 회원만 공고를 담을 수 있어요." };
  return null;
}

/** 담기(save=true) 또는 빼기(save=false) */
export async function setJobSaved(jobId: string, save: boolean): Promise<Result> {
  const bad = await check(jobId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("saved_jobs").insert({ job_id: Number(jobId) })
    : await supabase.from("saved_jobs").delete().eq("job_id", Number(jobId));
  // 이미 담겨 있으면(두 번 누름) 그대로 성공으로 본다
  if (error && error.code !== "23505") {
    console.error("[saved-jobs] 담기/빼기 실패", error.code, error.message);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  return { ok: true };
}

/** 관심 공고 화면에서 빼기. 목록을 바로 다시 그린다 */
export async function removeSavedJob(jobId: string): Promise<Result> {
  const result = await setJobSaved(jobId, false);
  if ("ok" in result) refresh();
  return result;
}

/** '지원했어요' 표시(applied=true) 또는 취소(applied=false) */
export async function setSavedJobApplied(jobId: string, applied: boolean): Promise<Result> {
  const bad = await check(jobId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_jobs")
    .update({ applied_at: applied ? new Date().toISOString() : null })
    .eq("job_id", Number(jobId));
  if (error) {
    console.error("[saved-jobs] 지원했어요 표시 실패", error.code, error.message);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  refresh();
  return { ok: true };
}
