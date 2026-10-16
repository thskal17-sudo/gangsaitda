import { seoulDateOf } from "@/lib/date";
import { PROFILE_BUCKET } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 강사 프로필 목록. 프로필과 회원 정보는 관리자만 전체를 읽을 수 있다
 * (supabase/instructor-profiles.sql, supabase/admin-members.sql).
 * 강사가 직접 낸 프로필(source: member)과 운영자가 직접 등록한 강사(source: admin, supabase/admin-instructors.sql)를 함께 보여 준다.
 */

export type AdminProfile = {
  /** 가입 강사는 회원번호, 등록 강사는 등록번호 (둘 다 겹치지 않는 긴 번호) */
  memberId: string;
  /** member: 강사가 직접 냄 · admin: 운영자가 직접 등록 */
  source: "member" | "admin";
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
  /** 운영자 등록 강사: 기관 전달 동의를 받았다고 확인한 날, 받은 방법 */
  consentDate?: string;
  consentNote?: string;
};

type AdminInstructorRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  fields: string[];
  regions: string[];
  file_path: string;
  file_name: string;
  consent_at: string;
  consent_note: string | null;
  updated_at: string;
};

const INSTRUCTOR_COLUMNS = "id, name, phone, email, fields, regions, file_path, file_name, consent_at, consent_note, updated_at";

function fromInstructor(row: AdminInstructorRow): AdminProfile {
  return {
    memberId: row.id,
    source: "admin",
    name: row.name,
    phone: row.phone,
    email: row.email ?? "",
    fields: Array.isArray(row.fields) ? row.fields : [],
    regions: Array.isArray(row.regions) ? row.regions : [],
    method: "file",
    career: "",
    certificates: "",
    intro: "",
    fileName: row.file_name,
    hasFile: Boolean(row.file_path),
    updatedDate: seoulDateOf(row.updated_at),
    consentDate: seoulDateOf(row.consent_at),
    consentNote: row.consent_note?.trim() || undefined,
  };
}

/** 운영자 등록 강사 한 명 (고치기 화면). 없으면 null */
export async function getAdminInstructor(id: string): Promise<AdminProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("admin_instructors").select(INSTRUCTOR_COLUMNS).eq("id", id).maybeSingle();
  return data ? fromInstructor(data as AdminInstructorRow) : null;
}

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

/** 모든 강사 프로필 (강사가 낸 것 + 운영자 등록) — 최근에 저장한 순 */
export async function getAllProfiles(): Promise<AdminProfile[]> {
  const supabase = await createClient();
  const [members, admins] = await Promise.all([
    supabase
      .from("instructor_profiles")
      .select("member_id, fields, regions, method, career, certificates, intro, file_path, file_name, updated_at, members(name, phone, email)")
      .order("updated_at", { ascending: false }),
    supabase.from("admin_instructors").select(INSTRUCTOR_COLUMNS).order("updated_at", { ascending: false }),
  ]);
  if (members.error) throw new Error(`강사 프로필을 불러오지 못했습니다: ${members.error.message}`);
  if (admins.error) throw new Error(`등록 강사를 불러오지 못했습니다: ${admins.error.message}`);

  const fromMembers: AdminProfile[] = (members.data as unknown as Row[]).map((row) => ({
    memberId: row.member_id,
    source: "member" as const,
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
  const fromAdmins = (admins.data as AdminInstructorRow[]).map(fromInstructor);
  return [...fromMembers, ...fromAdmins].sort((a, b) => b.updatedDate.localeCompare(a.updatedDate));
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
  let r = row as unknown as { file_path: string | null; file_name: string | null; members: { name: string } | null } | null;
  if (!r) {
    // 운영자 등록 강사
    const { data: admin } = await supabase.from("admin_instructors").select("file_path, file_name, name").eq("id", memberId).maybeSingle();
    const a = admin as { file_path: string; file_name: string; name: string } | null;
    if (a) r = { file_path: a.file_path, file_name: a.file_name, members: { name: a.name } };
  }
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
