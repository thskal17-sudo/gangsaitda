"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminStatus } from "@/lib/admin";
import { adminInstructorSchema } from "@/lib/admin-instructor-schema";
import { PROFILE_BUCKET, REQUEST_FILES_BUCKET } from "@/lib/profile";
import { PROFILE_FILE_MAX_BYTES, profileFileExtension } from "@/lib/profile-schema";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 강사 직접 등록 (사이트에 가입하지 않은 강사). 데이터베이스가 관리자인지 한 번 더 확인한다.
 * 파일은 브라우저가 저장소에 바로 올린다 (사이트 서버를 거치면 큰 파일이 막히므로).
 * 순서: prepareInstructorUpload 로 '올릴 자리'를 받음 → 브라우저가 올림 → saveInstructor 로 저장(바꾼 경우 전 파일은 지움).
 * 파일 자리: 프로필 저장소의 admin/등록번호/시각.확장자
 */

type Fail = { error: string };
const NOT_ADMIN: Fail = { error: "관리자만 할 수 있어요. 다시 로그인해 주세요." };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function folder(id: string) {
  return `admin/${id}/`;
}

/** 파일 올릴 자리. 새로 등록할 때는 등록번호를 여기서 정해 돌려준다. */
export async function prepareInstructorUpload(
  id: string | null,
  fileName: unknown,
  size: unknown,
): Promise<{ id: string; path: string; signedUrl: string } | Fail> {
  if ((await getAdminStatus()) !== "admin") return NOT_ADMIN;
  const instructorId = id ?? randomUUID();
  if (!UUID.test(instructorId)) return { error: "다시 시도해 주세요." };
  if (typeof fileName !== "string" || typeof size !== "number") return { error: "파일을 다시 골라 주세요." };
  const ext = profileFileExtension(fileName);
  if (!ext) return { error: "PDF, 파워포인트, 한글, 워드 파일만 올릴 수 있어요." };
  if (size <= 0 || size > PROFILE_FILE_MAX_BYTES) return { error: "파일은 10MB 까지 올릴 수 있어요." };

  const path = `${folder(instructorId)}${Date.now()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(PROFILE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[admin] 등록 강사 파일 올릴 자리 만들기 실패", error?.message);
    return { error: "파일을 올릴 준비를 하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { id: instructorId, path, signedUrl: data.signedUrl };
}

/**
 * 등록·고치기. isNew 면 새로 넣고(파일 필수), 아니면 고친다(파일은 바꿀 때만).
 * 동의 시각은 처음 등록할 때 정해지고, 고칠 때는 그대로 둔다.
 */
export async function saveInstructor(
  id: string,
  isNew: boolean,
  input: unknown,
  upload?: { path: string; fileName: string },
): Promise<{ ok: true } | Fail> {
  if ((await getAdminStatus()) !== "admin") return NOT_ADMIN;
  if (!UUID.test(id)) return { error: "다시 시도해 주세요." };
  const parsed = adminInstructorSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (upload && (typeof upload.path !== "string" || !upload.path.startsWith(folder(id)) || upload.path.includes(".."))) {
    return { error: "파일을 다시 올려 주세요." };
  }
  if (isNew && !upload) return { error: "프로필 파일을 올려 주세요." };

  const v = parsed.data;
  const values = {
    name: v.name,
    phone: v.phone,
    email: v.email || null,
    fields: v.fields,
    regions: v.regions,
    consent_note: v.consentNote || null,
    updated_at: new Date().toISOString(),
    ...(upload ? { file_path: upload.path, file_name: String(upload.fileName ?? "").slice(0, 200) || "프로필 파일" } : {}),
  };

  const supabase = await createClient();
  let before: string | null = null;
  if (!isNew) {
    const { data } = await supabase.from("admin_instructors").select("file_path").eq("id", id).maybeSingle();
    if (!data) return { error: "없는 강사예요. 목록에서 다시 골라 주세요." };
    before = (data as { file_path: string }).file_path;
  }

  const { error } = isNew
    ? await supabase.from("admin_instructors").insert({ id, ...values })
    : await supabase.from("admin_instructors").update(values).eq("id", id);
  if (error) {
    console.error("[admin] 등록 강사 저장 실패", error.code, error.message);
    if (upload) await supabase.storage.from(PROFILE_BUCKET).remove([upload.path]);
    return { error: "저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  if (upload && before && before !== upload.path) await supabase.storage.from(PROFILE_BUCKET).remove([before]);

  revalidatePath("/admin/profiles");
  revalidatePath("/admin/requests", "layout");
  return { ok: true };
}

/** 지우기: 등록 강사 줄(추천 줄은 데이터베이스가 함께 지움)과 프로필 파일·강의계획서 파일 */
export async function deleteInstructor(id: string): Promise<{ ok: true } | Fail> {
  if ((await getAdminStatus()) !== "admin") return NOT_ADMIN;
  if (!UUID.test(id)) return { error: "다시 시도해 주세요." };

  const supabase = await createClient();
  const [{ data: files }, { data: plans }] = await Promise.all([
    supabase.storage.from(PROFILE_BUCKET).list(`admin/${id}`),
    supabase.from("request_matches").select("plan_path").eq("instructor_id", id).not("plan_path", "is", null),
  ]);

  const { error } = await supabase.from("admin_instructors").delete().eq("id", id);
  if (error) {
    console.error("[admin] 등록 강사 지우기 실패", error.code, error.message);
    return { error: "지우지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  if (files && files.length > 0) await supabase.storage.from(PROFILE_BUCKET).remove(files.map((f) => `admin/${id}/${f.name}`));
  const planPaths = ((plans ?? []) as { plan_path: string }[]).map((p) => p.plan_path);
  if (planPaths.length > 0) await supabase.storage.from(REQUEST_FILES_BUCKET).remove(planPaths);

  revalidatePath("/admin/profiles");
  revalidatePath("/admin/requests", "layout");
  return { ok: true };
}
