"use server";

import { revalidatePath } from "next/cache";
import { getAdminStatus } from "@/lib/admin";
import { AD_IMAGE_MAX_BYTES, adImageExtension, homeAdSchema, toAdSlot } from "@/lib/home-ad-schema";
import { AD_BUCKET } from "@/lib/home-ads";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 광고 관리 (홈 화면 교육과정 카드 3개). 데이터베이스 규칙이 관리자인지 한 번 더 확인한다 (supabase/home-ads.sql).
 * 사진은 브라우저가 저장소에 바로 올린다.
 * 순서: prepareAdImageUpload 로 '올릴 자리'를 받음 → 브라우저가 올림 → saveAd 로 저장(사진을 바꾸면 전 사진은 지움).
 * 사진 자리: home-ads 저장소의 slot-칸번호/시각.확장자
 */

type Fail = { error: string };
const NOT_ADMIN: Fail = { error: "관리자만 할 수 있어요. 다시 로그인해 주세요." };
const SAVE_FAILED: Fail = { error: "저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };

function folder(slot: number) {
  return `slot-${slot}/`;
}

/** 홈 화면과 광고 관리 화면에 바로 반영 */
function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/ads");
}

/** 사진 올릴 자리 */
export async function prepareAdImageUpload(
  slotValue: unknown,
  type: unknown,
  size: unknown,
): Promise<{ path: string; signedUrl: string } | Fail> {
  if ((await getAdminStatus()) !== "admin") return NOT_ADMIN;
  const slot = toAdSlot(slotValue);
  if (!slot) return { error: "다시 시도해 주세요." };
  const ext = typeof type === "string" ? adImageExtension(type) : null;
  if (!ext) return { error: "jpg·png·webp·gif 사진만 올릴 수 있어요." };
  if (typeof size !== "number" || size <= 0 || size > AD_IMAGE_MAX_BYTES) return { error: "사진은 5MB 까지 올릴 수 있어요." };

  const path = `${folder(slot)}${Date.now()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(AD_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[admin] 광고 사진 올릴 자리 만들기 실패", error?.message);
    return { error: "사진을 올릴 준비를 하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { path, signedUrl: data.signedUrl };
}

/** 지금 칸의 사진 (저장소 파일이면 나중에 지우려고) */
async function currentImage(slot: number): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("home_ads").select("image").eq("slot", slot).maybeSingle();
  return (data?.image as string | null | undefined) ?? null;
}

/** 저장소에 올린 사진이면 지운다 ("/" 로 시작하는 사이트 안 그림은 그대로 둔다). 실패해도 저장은 된 것으로 본다. */
async function removeStoredImage(image: string | null) {
  if (!image || image.startsWith("/")) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(AD_BUCKET).remove([image]);
  if (error) console.error("[admin] 전 광고 사진 지우기 실패", error.message);
}

/**
 * 칸 저장. image: 새로 올린 사진 자리(path), "remove" 면 사진 빼기, 없으면 사진은 그대로.
 */
export async function saveAd(slotValue: unknown, input: unknown, image?: string): Promise<{ ok: true } | Fail> {
  if ((await getAdminStatus()) !== "admin") return NOT_ADMIN;
  const slot = toAdSlot(slotValue);
  if (!slot) return { error: "다시 시도해 주세요." };
  const parsed = homeAdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (image && image !== "remove" && (!image.startsWith(folder(slot)) || image.includes(".."))) {
    return { error: "사진을 다시 올려 주세요." };
  }

  const v = parsed.data;
  const before = await currentImage(slot);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_ads")
    .update({
      name: v.name,
      provider: v.provider || null,
      href: v.href,
      until: v.until || null,
      ended_text: v.endedText || null,
      ...(image ? { image: image === "remove" ? null : image } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("slot", slot)
    .select("slot");
  if (error || !data?.length) {
    console.error("[admin] 광고 저장 실패", error?.message ?? "바뀐 줄 없음");
    return SAVE_FAILED;
  }

  if (image && before !== image) await removeStoredImage(before);
  refresh();
  return { ok: true };
}

/** 칸 비우기: '교육 광고 모집합니다' 자리로 되돌린다 (올린 사진도 지운다). */
export async function clearAd(slotValue: unknown): Promise<{ ok: true } | Fail> {
  if ((await getAdminStatus()) !== "admin") return NOT_ADMIN;
  const slot = toAdSlot(slotValue);
  if (!slot) return { error: "다시 시도해 주세요." };

  const before = await currentImage(slot);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_ads")
    .update({ name: null, provider: null, href: null, image: null, until: null, ended_text: null, updated_at: new Date().toISOString() })
    .eq("slot", slot)
    .select("slot");
  if (error || !data?.length) {
    console.error("[admin] 광고 비우기 실패", error?.message ?? "바뀐 줄 없음");
    return { error: "비우지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
  }

  await removeStoredImage(before);
  refresh();
  return { ok: true };
}
