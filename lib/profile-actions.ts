"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/member";
import { PROFILE_BUCKET, removeProfileFiles } from "@/lib/profile";
import { PROFILE_FILE_MAX_BYTES, profileFileExtension, profileSchema } from "@/lib/profile-schema";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사 프로필 내기·고치기·지우기. 회원 본인만 (데이터베이스도 본인 것만 허락한다).
 * 파일은 브라우저가 Supabase 저장소에 바로 올린다 (사이트 서버를 거치면 큰 파일이 막히므로).
 * 순서: prepareProfileUpload 로 '올릴 자리'를 받음 → 브라우저가 올림 → saveProfile 로 저장.
 */

type Fail = { error: string };
const notLoggedIn: Fail = { error: "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요." };

/** 파일 올릴 자리 받기. 회원번호 폴더 안에 새 이름(시각.확장자)으로 둔다 (한글 파일 이름은 저장소가 받지 않아서). */
export async function prepareProfileUpload(
  fileName: unknown,
  size: unknown,
): Promise<{ path: string; signedUrl: string } | Fail> {
  const member = await getCurrentMember();
  if (!member) return notLoggedIn;
  if (typeof fileName !== "string" || typeof size !== "number") return { error: "파일을 다시 골라 주세요." };
  const ext = profileFileExtension(fileName);
  if (!ext) return { error: "PDF, 파워포인트, 한글, 워드 파일만 올릴 수 있어요." };
  if (size <= 0 || size > PROFILE_FILE_MAX_BYTES) return { error: "파일은 10MB 까지 올릴 수 있어요." };

  const path = `${member.id}/${Date.now()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(PROFILE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[profile] 올릴 자리 만들기 실패", error?.message);
    return { error: "파일을 올릴 준비를 하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { path, signedUrl: data.signedUrl };
}

/** 프로필 저장. 파일로 낼 때는 방금 올린 파일 자리(path)와 원래 파일 이름을 함께 받는다. */
export async function saveProfile(
  input: unknown,
  upload?: { path: string; fileName: string },
): Promise<{ ok: true } | Fail> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const member = await getCurrentMember();
  if (!member) return notLoggedIn;
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("instructor_profiles")
    .select("file_path, file_name")
    .eq("member_id", member.id)
    .maybeSingle();

  // 파일로 낼 때: 새로 올린 파일이 있으면 그것, 없으면 전에 올린 파일을 그대로 쓴다.
  let filePath: string | null = null;
  let fileName: string | null = null;
  if (v.method === "file") {
    if (upload) {
      if (typeof upload.path !== "string" || !upload.path.startsWith(`${member.id}/`) || upload.path.includes("..")) {
        return { error: "파일을 다시 올려 주세요." };
      }
      filePath = upload.path;
      fileName = String(upload.fileName ?? "").slice(0, 200) || "프로필 파일";
    } else if (before?.file_path) {
      filePath = before.file_path;
      fileName = before.file_name;
    } else {
      return { error: "프로필 파일을 골라 주세요." };
    }
  }

  const row = {
    member_id: member.id,
    consent_at: new Date().toISOString(),
    fields: v.fields,
    regions: v.regions,
    method: v.method,
    career: v.method === "form" ? v.career : null,
    certificates: v.method === "form" && v.certificates ? v.certificates : null,
    intro: v.method === "form" && v.intro ? v.intro : null,
    file_path: filePath,
    file_name: fileName,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("instructor_profiles").upsert(row);
  if (error) {
    console.error("[profile] 저장 실패", error.code, error.message);
    return { error: "프로필을 저장하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  // 전에 올린 파일이 더는 쓰이지 않으면 지운다 (새 파일로 바꿨거나 양식으로 바꾼 경우).
  if (before?.file_path && before.file_path !== filePath) {
    await supabase.storage.from(PROFILE_BUCKET).remove([before.file_path]);
  }

  revalidatePath("/account/profile");
  revalidatePath("/");
  return { ok: true };
}

/** 프로필 삭제 (동의 철회). 올린 파일도 모두 지운다. */
export async function deleteProfile(): Promise<{ ok: true } | Fail> {
  const member = await getCurrentMember();
  if (!member) return notLoggedIn;
  const supabase = await createClient();

  await removeProfileFiles(member.id);
  const { error } = await supabase.from("instructor_profiles").delete().eq("member_id", member.id);
  if (error) {
    console.error("[profile] 삭제 실패", error.code, error.message);
    return { error: "프로필을 지우지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  revalidatePath("/account/profile");
  revalidatePath("/");
  return { ok: true };
}
