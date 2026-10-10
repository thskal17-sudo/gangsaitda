/**
 * 공고를 지역 탭으로 나누는 기준 (홈 공고 표, 공고 화면).
 *
 * 권역을 늘리려면 아래 목록에 한 줄만 더한다 (예: "경북"). 탭·숫자·주소(?region=경북)가 함께 생긴다.
 * 공고의 '지역' 칸 첫 단어로 권역을 정한다: "부산 북구" → 부산, "경남 창원시" → 경남.
 * 목록에 없는 지역(예: 서울)은 '전체'에서만 보인다.
 */
export const REGION_GROUPS = ["부산", "울산", "경남"] as const;

export type RegionGroup = (typeof REGION_GROUPS)[number];

/** "부산 북구" → "부산". 목록에 없는 지역이면 null. */
export function regionGroupOf(region: string | null | undefined): RegionGroup | null {
  const first = (region ?? "").trim().split(/\s+/)[0];
  return (REGION_GROUPS as readonly string[]).includes(first) ? (first as RegionGroup) : null;
}

/** 주소의 ?region= 값이 목록에 있는 권역이면 돌려주고, 아니면 null(= 전체). */
export function parseRegionParam(value: string | string[] | undefined): RegionGroup | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text && (REGION_GROUPS as readonly string[]).includes(text) ? (text as RegionGroup) : null;
}

/** 공고의 권역: 회원 목록은 '지역' 칸으로, 비회원 목록은 함수가 준 권역으로 */
export function regionGroupOfJob(job: { region?: string; regionGroup?: string }): RegionGroup | null {
  return regionGroupOf("region" in job && job.region ? job.region : job.regionGroup);
}

/** 권역별 공고 수 */
export function countByRegion(jobs: { region?: string; regionGroup?: string }[]): Record<RegionGroup, number> {
  const counts = Object.fromEntries(REGION_GROUPS.map((g) => [g, 0])) as Record<RegionGroup, number>;
  for (const job of jobs) {
    const group = regionGroupOfJob(job);
    if (group) counts[group] += 1;
  }
  return counts;
}
