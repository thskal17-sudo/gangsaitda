import { type Course, coursesOn } from "@/lib/courses";
import { AD_SLOTS, type AdSlot } from "@/lib/home-ad-schema";
import { supabaseEnvOrNull } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/*
 * 홈 화면 '강사 경력에 더하는 교육과정' 카드 3개. 운영자가 광고 관리(/admin/ads)에서 고친다.
 * 데이터는 Supabase home_ads 표, 사진은 home-ads 저장소 (supabase/home-ads.sql).
 * 아직 SQL 을 실행하지 않았으면 예전처럼 lib/courses.ts 의 COURSES 를 보여 준다.
 * (교육 소개 화면 /courses/… 의 긴 소개 글은 지금도 lib/courses.ts 에 있다.)
 */

export const AD_BUCKET = "home-ads";

/** 칸마다 정해진 색 (사진이 없을 때 상자 글자색) */
const TONES: Record<AdSlot, Course["tone"]> = { 1: "brand", 2: "accent", 3: "ok" };

export type HomeAd = {
  slot: AdSlot;
  name: string;
  provider: string;
  href: string;
  /** "/" 로 시작하면 사이트 안의 그림, 아니면 저장소 안의 파일 이름. 없으면 빈 글자 */
  image: string;
  /** 한국 날짜 YYYY-MM-DD. 없으면 빈 글자 */
  until: string;
  endedText: string;
};

type Row = {
  slot: number;
  name: string | null;
  provider: string | null;
  href: string | null;
  image: string | null;
  until: string | null;
  ended_text: string | null;
};

/** 사진을 화면에 띄울 주소. 저장소 파일이면 공개 주소로 바꾼다. */
export function adImageUrl(image: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith("/")) return image;
  const env = supabaseEnvOrNull();
  return env ? `${env.url}/storage/v1/object/public/${AD_BUCKET}/${image}` : undefined;
}

/** 광고 칸 3개 (1·2·3번 순). 표가 없거나 읽지 못하면 null */
export async function getHomeAds(): Promise<HomeAd[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("home_ads").select("slot, name, provider, href, image, until, ended_text").order("slot");
  if (error) {
    console.error("광고 칸을 불러오지 못했습니다:", error.message);
    return null;
  }
  const rows = new Map((data as Row[]).map((r) => [r.slot, r]));
  return AD_SLOTS.map((slot) => {
    const r = rows.get(slot);
    return {
      slot,
      name: r?.name ?? "",
      provider: r?.provider ?? "",
      href: r?.href ?? "",
      image: r?.image ?? "",
      until: r?.until ?? "",
      endedText: r?.ended_text ?? "",
    };
  });
}

/** 홈 화면 카드 3개. 신청 마감일이 지난 과정은 '지난 교육'으로 표시한다. */
export async function homeCourses(today: string): Promise<Course[]> {
  const ads = await getHomeAds();
  if (!ads) return coursesOn(today);
  return ads.map((ad) => ({
    name: ad.name,
    provider: ad.provider || undefined,
    href: ad.href || undefined,
    image: adImageUrl(ad.image),
    until: ad.until || undefined,
    endedText: ad.endedText || undefined,
    ended: Boolean(ad.until && ad.until < today),
    tone: TONES[ad.slot],
  }));
}
