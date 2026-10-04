import { seoulDateOf } from "@/lib/date";
import { PROFILE_BUCKET } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 강사 프로필 목록. 프로필과 회원 정보는 관리자만 전체를 읽을 수 있다
 * (supabase/instructor-profiles.sql, supabase/admin-members.sql). 보기·내려받기만 한다.
 */

export type AdminProfile = {
  memberId: string;
  name: string;
  /** 숫자만. 운영자 확인용 (기관에는 섭외 확정 뒤에만) */
  phone: string;
  email: string;
  fields: string[];
  regions: string[];
  method: "form" | "file";
  career: string;
  certificates: string;
  intro: string;
  fileName: string | null;
  hasFile: boolean;
  /** 마지막으로 저장한 날 (한국 날짜) */
  updatedDate: string;
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
  updated_at: string;
  members: { name: string; phone: string; email: string } | null;
};

/** 모든 강사 프로필 — 최근에 저장한 순 */
export async function getAllProfiles(): Promise<AdminProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructor_profiles")
    .select("member_id, fields, regions, method, career, certificates, intro, file_path, file_name, updated_at, members(name, phone, email)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`강사 프로필을 불러오지 못했습니다: ${error.message}`);

  return (data as unknown as Row[]).map((row) => ({
    memberId: row.member_id,
    name: row.members?.name ?? "(이름 없음)",
    phone: row.members?.phone ?? "",
    email: row.members?.email ?? "",
    fields: Array.isArray(row.fields) ? row.fields : [],
    regions: Array.isArray(row.regions) ? row.regions : [],
    method: row.method,
    career: row.career ?? "",
    certificates: row.certificates ?? "",
    intro: row.intro ?? "",
    fileName: row.file_name,
    hasFile: row.method === "file" && Boolean(row.file_path),
    updatedDate: seoulDateOf(row.updated_at),
  }));
}

/**
 * 프로필 파일을 잠깐(1분)만 열리는 주소로 만든다. 내려받을 때 원래 파일 이름 앞에 강사 이름을 붙인다.
 * 관리자가 아니면 데이터베이스가 아무것도 내주지 않아 null.
 */
export async function getProfileFileUrl(memberId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return null;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("instructor_profiles")
    .select("file_path, file_name, members(name)")
    .eq("member_id", memberId)
    .maybeSingle();
  const r = row as unknown as { file_path: string | null; file_name: string | null; members: { name: string } | null } | null;
  if (!r?.file_path) return null;

  const downloadName = `${r.members?.name ?? "강사"}_${r.file_name ?? "프로필"}`;
  const { data, error } = await supabase.storage.from(PROFILE_BUCKET).createSignedUrl(r.file_path, 60);
  if (error || !data) {
    console.error("[admin] 프로필 파일 주소 만들기 실패", error?.message);
    return null;
  }
  // 내려받을 이름은 직접 붙인다. 라이브러리의 download 옵션은 한글 이름을 두 번 바꿔(인코딩) 깨뜨린다.
  return `${data.signedUrl}&download=${encodeURIComponent(downloadName)}`;
}
