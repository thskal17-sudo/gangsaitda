import { redirect } from "next/navigation";
import type { JobInput } from "@/lib/admin-job-schema";
import { seoulDateOf } from "@/lib/date";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 화면(/admin)용 데이터.
 * 관리자 명단은 데이터베이스(supabase/admins.sql)에 있고, 사이트는 명단을 볼 수 없다.
 * 대신 '지금 로그인한 사람이 관리자인가?'를 참/거짓으로만 물어본다 (is_admin 함수).
 */

/** guest: 로그인 안 함 · member: 일반 회원 · admin: 관리자 */
export type AdminStatus = "guest" | "member" | "admin";

export async function getAdminStatus(): Promise<AdminStatus> {
  const member = await getCurrentMember();
  if (!member) return "guest";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  // 확인에 실패하면 관리자가 아닌 것으로 본다 (문을 여는 쪽으로 틀리지 않게).
  if (error) {
    console.error("관리자 확인 실패:", error.message);
    return "member";
  }
  return data === true ? "admin" : "member";
}

/**
 * 관리자 화면 입구. 로그인 안 했으면 로그인 화면으로 보내고(로그인 뒤 path 로 돌아옴),
 * 로그인했으면 관리자인지(true) 아닌지(false) 돌려준다.
 */
export async function checkAdmin(path: string): Promise<boolean> {
  const status = await getAdminStatus();
  if (status === "guest") redirect(`/login?next=${encodeURIComponent(path)}`);
  return status === "admin";
}

/** 관리자 목록 한 줄. 상세(기관·지역·마감일)가 아직 없는 공고는 그 칸이 비어 있다. */
export type AdminJob = {
  id: string;
  title: string;
  /** 올린 날 (한국 날짜) */
  createdDate: string;
  organization?: string;
  region?: string;
  deadline?: string;
  /** 숨긴 공고 (사이트에는 안 보이고 관리자 화면에만 보임) */
  hidden: boolean;
};

type AdminJobRow = {
  id: number;
  title: string;
  created_at: string;
  hidden_at: string | null;
  job_details: { organization: string; region: string; deadline: string } | null;
};

/** 모든 공고 — 마감된 것까지, 최근에 올린 순. 관리자 화면에서만 부른다. */
export async function getAllJobsForAdmin(): Promise<AdminJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, created_at, hidden_at, job_details(organization, region, deadline)")
    .order("id", { ascending: false });
  if (error) throw new Error(`공고를 불러오지 못했습니다 (관리자 목록): ${error.message}`);

  return (data as unknown as AdminJobRow[]).map((row) => ({
    id: String(row.id),
    title: row.title,
    createdDate: seoulDateOf(row.created_at),
    organization: row.job_details?.organization,
    region: row.job_details?.region,
    deadline: row.job_details?.deadline,
    hidden: row.hidden_at !== null,
  }));
}

type EditRow = {
  id: number;
  title: string;
  hidden_at: string | null;
  job_details: {
    organization: string;
    region: string;
    deadline: string;
    schedule: string;
    target: string | null;
    headcount: number | null;
    description: string;
    qualifications: string | null;
    documents: string | null;
    source_url: string | null;
    apply_url: string | null;
    apply_email: string | null;
  } | null;
};

/** 수정 화면에 채워 넣을 공고 하나 (숨긴 공고, 상세가 없는 공고도). 없으면 null. */
export async function getJobForEdit(id: string): Promise<{ id: string; hidden: boolean; values: JobInput } | null> {
  if (!/^\d{1,15}$/.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, hidden_at, job_details(*)")
    .eq("id", Number(id))
    .maybeSingle();
  if (error) throw new Error(`공고를 불러오지 못했습니다 (수정): ${error.message}`);
  if (!data) return null;

  const row = data as unknown as EditRow;
  const d = row.job_details;
  return {
    id: String(row.id),
    hidden: row.hidden_at !== null,
    values: {
      title: row.title,
      organization: d?.organization ?? "",
      region: d?.region ?? "",
      deadline: d?.deadline ?? "",
      schedule: d?.schedule ?? "",
      target: d?.target ?? "",
      headcount: d?.headcount ? String(d.headcount) : "",
      description: d?.description ?? "",
      qualifications: d?.qualifications ?? "",
      documents: d?.documents ?? "",
      sourceUrl: d?.source_url ?? "",
      applyUrl: d?.apply_url ?? "",
      applyEmail: d?.apply_email ?? "",
    },
  };
}
