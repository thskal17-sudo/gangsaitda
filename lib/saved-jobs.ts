import { seoulDateOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사 회원 · 관심 공고 (supabase/saved-jobs.sql). 표의 규칙상 본인 줄만 읽힌다.
 * 담기·빼기·지원했어요 표시는 lib/saved-jobs-actions.ts.
 */

export type SavedJob = {
  jobId: string;
  title: string;
  organization: string;
  region: string;
  /** 마감일 (한국 날짜) */
  deadline: string;
  /** 담은 날 (한국 날짜) */
  savedDate: string;
  /** '지원했어요'를 누른 날 (한국 날짜). 안 눌렀으면 없음 */
  appliedDate?: string;
};

type Row = {
  job_id: number;
  created_at: string;
  applied_at: string | null;
  jobs: {
    title: string;
    job_details: { organization: string; region: string; deadline: string } | null;
  } | null;
};

/** 내가 담은 공고 번호들 (공고 목록·상세에서 별 표시용). 표가 아직 없거나 읽지 못하면 빈 묶음 */
export async function getMySavedJobIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("saved_jobs").select("job_id");
  if (error) {
    console.error("[saved-jobs] 담은 공고 번호 읽기 실패", error.code, error.message);
    return new Set();
  }
  return new Set((data as { job_id: number }[]).map((r) => String(r.job_id)));
}

/**
 * 내가 담은 공고 — 마감 전 공고는 마감 가까운 순, 마감이 지난 공고는 그 아래 최근 마감 순.
 * 표가 아직 없으면(SQL 실행 전) null
 */
export async function getMySavedJobs(today: string): Promise<SavedJob[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_jobs")
    .select("job_id, created_at, applied_at, jobs!inner(title, job_details(organization, region, deadline))");
  if (error) {
    console.error("[saved-jobs] 관심 공고 읽기 실패", error.code, error.message);
    return null;
  }
  const jobs = (data as unknown as Row[])
    .filter((r) => r.jobs?.job_details)
    .map((r) => ({
      jobId: String(r.job_id),
      title: r.jobs!.title,
      organization: r.jobs!.job_details!.organization,
      region: r.jobs!.job_details!.region,
      deadline: r.jobs!.job_details!.deadline,
      savedDate: seoulDateOf(r.created_at),
      appliedDate: r.applied_at ? seoulDateOf(r.applied_at) : undefined,
    }));
  const open = jobs.filter((j) => j.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const closed = jobs.filter((j) => j.deadline < today).sort((a, b) => b.deadline.localeCompare(a.deadline));
  return [...open, ...closed];
}
