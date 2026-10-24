"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { type ApplyUpload, applySchema } from "@/lib/apply-schema";
import { sendKakaoToMe } from "@/lib/kakao";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { REQUEST_FILES_BUCKET } from "@/lib/profile";
import { REQUEST_FILE_MAX_BYTES, requestFileExtension } from "@/lib/request-files";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사 회원 · 공고 지원하기. 데이터베이스 함수 apply_to_posting 이 '강사 회원인지, 지원받는 공고인지, 마감 전인지,
 * 프로필이나 파일이 있는지, 처음 지원인지'를 한 번 더 확인한다 (supabase/job-apply.sql).
 * 파일은 브라우저가 저장소에 바로 올린다. 순서: prepareApplyUpload 로 '올릴 자리' 받기 → 브라우저가 올림 → submitApplication.
 * 파일 자리: request-files 저장소의 의뢰번호/apply/회원번호/종류-시각.확장자 (저장소 규칙상 본인 폴더만 올릴 수 있다)
 */

type Fail = { error: string };
const ID = /^\d{1,15}$/;
const NOT_LOGGED_IN: Fail = { error: "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요." };

/** 공고 번호 → 의뢰 번호 (강사잇다에서 지원받는 공고만 있다). 회원은 공고 표의 번호·제목을 읽을 수 있다. */
async function requestIdOf(jobId: string): Promise<string | null> {
  if (!ID.test(jobId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("request_id").eq("id", Number(jobId)).maybeSingle();
  const rid = (data as { request_id: number | null } | null)?.request_id;
  return rid == null ? null : String(rid);
}

export async function prepareApplyUpload(
  jobId: string,
  kind: unknown,
  fileName: unknown,
  size: unknown,
): Promise<{ path: string; signedUrl: string } | Fail> {
  const member = await getCurrentMember();
  if (!member) return NOT_LOGGED_IN;
  if ((await getMemberType()) === "기관") return { error: "강사 회원만 지원할 수 있어요." };
  if (kind !== "profile" && kind !== "plan") return { error: "다시 시도해 주세요." };
  if (typeof fileName !== "string" || typeof size !== "number") return { error: "파일을 다시 골라 주세요." };
  const ext = requestFileExtension(fileName);
  if (!ext) return { error: "PDF, 한글, 워드, 파워포인트, 사진(JPG·PNG) 파일만 올릴 수 있어요." };
  if (size <= 0 || size > REQUEST_FILE_MAX_BYTES) return { error: "파일은 10MB 까지 올릴 수 있어요." };
  const requestId = await requestIdOf(jobId);
  if (!requestId) return { error: "강사잇다에서 지원을 받는 공고가 아니에요." };

  const path = `${requestId}/apply/${member.id}/${kind}-${Date.now()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(REQUEST_FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[apply] 올릴 자리 만들기 실패", error?.message);
    return { error: "파일을 올릴 준비를 하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { path, signedUrl: data.signedUrl };
}

/** 지원 보내기. 성공하면 공고 화면으로 돌아간다 (?applied=1). 돌아온 값이 있으면 실패다. */
export async function submitApplication(
  jobId: string,
  input: unknown,
  files: { profile?: ApplyUpload; plan?: ApplyUpload },
): Promise<Fail | undefined> {
  const member = await getCurrentMember();
  if (!member) return NOT_LOGGED_IN;
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const requestId = await requestIdOf(jobId);
  if (!requestId) return { error: "강사잇다에서 지원을 받는 공고가 아니에요." };

  const folder = `${requestId}/apply/${member.id}/`;
  const ok = (u?: ApplyUpload) => !u || (typeof u.path === "string" && u.path.startsWith(folder) && !u.path.includes(".."));
  if (!ok(files.profile) || !ok(files.plan)) return { error: "파일을 다시 올려 주세요." };
  const name = (u?: ApplyUpload) => (u ? String(u.fileName ?? "").slice(0, 200) || null : null);

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_to_posting", {
    p_job_id: Number(jobId),
    p_message: parsed.data.message || null,
    p_profile_path: files.profile?.path ?? null,
    p_profile_name: name(files.profile),
    p_plan_path: files.plan?.path ?? null,
    p_plan_name: name(files.plan),
  });
  if (error) {
    console.error("[apply] 지원 실패", error.code, error.message);
    // 저장이 안 됐으니 올린 파일은 치운다 (저장소 규칙상 본인 파일만 지워진다)
    const paths = [files.profile?.path, files.plan?.path].filter((p): p is string => Boolean(p));
    if (paths.length > 0) await supabase.storage.from(REQUEST_FILES_BUCKET).remove(paths);
    if (error.code === "23505") return { error: "이미 지원한 공고예요." };
    if (error.code === "22023" || error.code === "P0002" || error.code === "42501") return { error: `${error.message}.` };
    return { error: "지원을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }

  // 운영자 카톡 알림 (글은 지금 만들고, 보내기만 응답 뒤로)
  const [{ data: job }, { data: me }] = await Promise.all([
    supabase.from("jobs").select("title").eq("id", Number(jobId)).maybeSingle(),
    supabase.from("members").select("name").eq("id", member.id).maybeSingle(),
  ]);
  const text = `[강사잇다] 공고에 새 지원자가 왔어요\n공고: ${(job as { title: string } | null)?.title ?? ""}\n지원자: ${(me as { name: string } | null)?.name ?? ""}`;
  after(() => sendKakaoToMe(text, `${SITE_URL}/admin/requests/${requestId}`, "지원자 보기"));

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/account/requests/${requestId}`);
  revalidatePath("/account/requests");
  redirect(`/jobs/${jobId}?applied=1`);
}
