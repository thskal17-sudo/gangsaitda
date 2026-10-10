import Link from "next/link";
import { REGION_GROUPS, type RegionGroup } from "@/lib/regions";

/**
 * 지역 탭: 전체 · 부산 · 울산 · 경남 (lib/regions.ts 의 목록 순서). 각 탭에 공고 수를 같이 보여준다.
 * 누르면 주소에 ?region=부산 이 붙어 그 지역만 보인다 (뒤로가기·공유가 된다). '전체'는 region 을 뗀다.
 * 휴대폰에서는 옆으로 밀어 볼 수 있고, PC 에서는 한 줄에 다 보인다.
 */
export default function RegionTabs({
  active,
  counts,
  total,
  basePath,
  keepParams = {},
}: {
  /** 지금 고른 권역. null 이면 전체 */
  active: RegionGroup | null;
  /** 권역별 공고 수 */
  counts: Record<RegionGroup, number>;
  /** 전체 공고 수 */
  total: number;
  /** 탭을 눌렀을 때 갈 화면 (예: "/" 또는 "/jobs") */
  basePath: string;
  /** 같이 남겨야 하는 주소 값 (예: { view: "today" }) */
  keepParams?: Record<string, string>;
}) {
  const hrefOf = (group: RegionGroup | null) => {
    const params = new URLSearchParams(keepParams);
    if (group) params.set("region", group);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const tabs: { group: RegionGroup | null; label: string; count: number }[] = [
    { group: null, label: "전체", count: total },
    ...REGION_GROUPS.map((group) => ({ group, label: group, count: counts[group] })),
  ];

  return (
    <nav aria-label="지역별 공고" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1.5 md:gap-2">
        {tabs.map((tab) => {
          const isActive = tab.group === active;
          return (
            <li key={tab.label}>
              <Link
                href={hrefOf(tab.group)}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-9 items-center gap-1.5 rounded-badge px-3.5 text-[14px] font-bold whitespace-nowrap transition-colors md:h-10 md:px-4 md:text-[15px] ${
                  isActive ? "bg-ink text-white" : "bg-bg text-[#4E5968] hover:bg-line"
                }`}
              >
                {tab.label}
                <span className={`nums text-[12px] font-semibold md:text-[13px] ${isActive ? "text-white/70" : "text-muted"}`}>
                  {tab.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
