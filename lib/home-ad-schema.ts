import { z } from "zod";

/*
 * 관리자 · 광고 관리 양식 규칙. 데이터베이스 규칙(supabase/home-ads.sql)과 같다.
 * 과정 이름이 있어야 광고로 보이고, 이름을 비워 저장하려면 [비우기]를 쓴다.
 */

/** 광고 칸 수 (홈 화면 카드 3개) */
export const AD_SLOTS = [1, 2, 3] as const;
export type AdSlot = (typeof AD_SLOTS)[number];

export function toAdSlot(value: unknown): AdSlot | null {
  const n = Number(value);
  return (AD_SLOTS as readonly number[]).includes(n) ? (n as AdSlot) : null;
}

/** 사진: jpg·png·webp·gif, 5MB 까지 */
export const AD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const AD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const EXTENSION: Record<(typeof AD_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 올릴 수 있는 사진이면 확장자, 아니면 null */
export function adImageExtension(type: string): string | null {
  return EXTENSION[type as keyof typeof EXTENSION] ?? null;
}

export const homeAdSchema = z.object({
  name: z.string().trim().min(1, "과정 이름을 적어 주세요.").max(60, "과정 이름은 60자까지 적을 수 있어요."),
  provider: z.string().trim().max(60, "60자까지 적을 수 있어요."),
  href: z
    .string()
    .trim()
    .min(1, "누르면 갈 주소를 적어 주세요.")
    .max(500, "주소가 너무 길어요.")
    .refine(
      (v) => /^https:\/\/\S+$/.test(v) || /^\/\S*$/.test(v),
      "https:// 로 시작하는 주소나, /courses/… 같은 강사잇다 안의 주소를 적어 주세요.",
    ),
  until: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "날짜를 다시 골라 주세요."),
  endedText: z.string().trim().max(60, "60자까지 적을 수 있어요."),
});

export type HomeAdFormValues = z.infer<typeof homeAdSchema>;
