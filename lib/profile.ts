import { createClient } from "@/lib/supabase/server";

/*
 * 강사 프로필 읽기. 회원은 자기 것만, 관리자는 전부 읽을 수 있다 (supabase/instructor-profiles.sql).
 */

/** 프로필 파일을 두는 저장소 (공개 안 함) */
export const PROFILE_BUCKET = "instructor-profiles";

export type Profile = {
  memberId: string;
  fields: string;
  regions: string[];
  method: "form" | "file";
  career: string;
  certificates: string;
  intro: string;
  filePath: string | null;
  fileName: string | null;
  updatedAt: string;
};

type Row = {
  member_id: string;
  fields: string;
  regions: string[];
  method: "form" | "file";
  career: string | null;
  certificates: string | null;
  intro: string | null;
  file_path: string | null;
  file_name: string | null;
  updated_at: string;
};

function toProfile(row: Row): Profile {
  return {
    memberId: row.member_id,
    fields: row.fields,
    regions: row.regions,
    method: row.method,
    career: row.career ?? "",
    certificates: row.certificates ?? "",
    intro: row.intro ?? "",
    filePath: row.file_path,
    fileName: row.file_name,
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

/** 그 회원 폴더의 프로필 파일을 모두 지운다 (프로필 삭제·회원 탈퇴). 저장소 규칙상 본인 파일만 지워진다. */
export async function removeProfileFiles(memberId: string): Promise<void> {
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from(PROFILE_BUCKET).list(memberId);
  if (files && files.length > 0) {
    await supabase.storage.from(PROFILE_BUCKET).remove(files.map((f) => `${memberId}/${f.name}`));
  }
}
