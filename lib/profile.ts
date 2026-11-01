import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/*
 * 강사 프로필 읽기. 회원은 자기 것만, 관리자는 전부 읽을 수 있다 (supabase/instructor-profiles.sql).
 */

/** 프로필 파일을 두는 저장소 (공개 안 함) */
export const PROFILE_BUCKET = "instructor-profiles";

/** 운영자가 추천 강사마다 올리는 강의계획서 저장소 (공개 안 함, supabase/request-portal.sql) */
export const REQUEST_FILES_BUCKET = "request-files";

export type Profile = {
  memberId: string;
  fields: string[];
  regions: string[];
  method: "form" | "file";
  career: string;
  certificates: string;
  intro: string;
  filePath: string | null;
  fileName: string | null;
  /** 대표 강의계획서 (선택). 운영자가 확인하면 '강의계획서 확인' 배지가 붙는다 */
  samplePlanPath: string | null;
  samplePlanName: string | null;
  updatedAt: string;
};

type Row = {
  member_id: string;
  fields: string[];
  regions: string[];
  method: "form" | "file";
  career: string | null;
  certificates: string | null;
  intro: string | null;
  file_path: string | null;
  file_name: string | null;
  sample_plan_path: string | null;
  sample_plan_name: string | null;
  updated_at: string;
};

function toProfile(row: Row): Profile {
  return {
    memberId: row.member_id,
    fields: Array.isArray(row.fields) ? row.fields : [],
    regions: row.regions,
    method: row.method,
    career: row.career ?? "",
    certificates: row.certificates ?? "",
    intro: row.intro ?? "",
    filePath: row.file_path,
    fileName: row.file_name,
    samplePlanPath: row.sample_plan_path ?? null,
    samplePlanName: row.sample_plan_name ?? null,
    updatedAt: row.updated_at,
  };
}

/** 내 프로필. 아직 안 냈으면 null */
export async function getMyProfile(memberId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("instructor_profiles").select("*").eq("member_id", memberId).maybeSingle();
  if (error) throw new Error(`프로필을 불러오지 못했습니다: ${error.message}`);
  return data ? toProfile(data as Row) : null;
}

/** 운영자 확인 배지 상태. 확인 = 배지 붙음, 다시 확인 = 확인한 뒤 내용이 바뀌어 배지가 내려감 (supabase/profile-badges.sql) */
export type CheckStatus = "확인" | "다시 확인";

export function toCheckStatus(value: unknown): CheckStatus | undefined {
  return value === "확인" || value === "다시 확인" ? value : undefined;
}

/** 내 프로필의 배지 상태. 운영자가 아직 확인하지 않았으면 둘 다 없음 */
export async function getMyProfileChecks(): Promise<{ profile?: CheckStatus; plan?: CheckStatus }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_profile_checks");
  if (error) {
    console.error("[profile] 배지 상태 불러오기 실패", error.message);
    return {};
  }
  const row = (data as { profile_status: string | null; plan_status: string | null }[])[0];
  return { profile: toCheckStatus(row?.profile_status), plan: toCheckStatus(row?.plan_status) };
}

/**
 * 그 회원 폴더의 프로필 파일을 모두 지운다 (프로필 삭제). 저장소 규칙상 본인 파일만 지워진다.
 * 운영자가 이 강사의 **추천** 줄에 올려 둔 강의계획서도 함께 지운다 (추천 줄은 프로필을 지우면 데이터베이스가 함께 지운다).
 * 강사가 공고에 직접 지원한 줄과 그 파일은 남는다 (지원은 프로필과 별개).
 * 강의계획서는 강사가 직접 지울 수 없는 저장소라 사이트 서버 열쇠(SUPABASE_SECRET_KEY)로 지운다. 프로필을 지우기 **전에** 불러야 한다.
 */
export async function removeProfileFiles(memberId: string): Promise<void> {
  await removeMemberFiles(memberId, "profile");
}

/**
 * 회원 탈퇴: 프로필 파일 + 추천·지원 줄의 강의계획서·지원 프로필 파일을 모두 지운다 (줄은 데이터베이스가 함께 지운다).
 * 계정을 지우기 **전에** 불러야 한다.
 */
export async function removeAllMemberFiles(memberId: string): Promise<void> {
  await removeMemberFiles(memberId, "all");
}

async function removeMemberFiles(memberId: string, scope: "profile" | "all"): Promise<void> {
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from(PROFILE_BUCKET).list(memberId);
  if (files && files.length > 0) {
    await supabase.storage.from(PROFILE_BUCKET).remove(files.map((f) => `${memberId}/${f.name}`));
  }

  const service = createServiceClient();
  if (!service) return;
  let query = service.from("request_matches").select("plan_path, apply_profile_path").eq("member_id", memberId);
  if (scope === "profile") query = query.is("applied_at", null);
  const { data: rows, error } = await query;
  if (error) {
    console.error("[profile] 강의계획서 찾기 실패", error.message);
    return;
  }
  const paths = (rows as { plan_path: string | null; apply_profile_path: string | null }[])
    .flatMap((r) => [r.plan_path, r.apply_profile_path])
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) await service.storage.from(REQUEST_FILES_BUCKET).remove(paths);
}
