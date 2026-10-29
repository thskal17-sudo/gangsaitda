import { SOURCE_LABELS, type Source } from "@/lib/page-view";
import { addDays } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 현황(대시보드) 숫자. 데이터베이스 함수 admin_site_stats 가 관리자인지 확인하고
 * 날짜별 열람 수·새 가입자 수·새 의뢰 수, 들어온 경로, 많이 본 공고를 한 번에 돌려준다 (supabase/page-views.sql).
 */

/** 그래프·경로·많이 본 공고를 보는 기간 (오늘 포함) */
export const STATS_DAYS = 14;

export type DailyStat = { date: string; views: number; members: number; requests: number };

export type SiteStats = {
  /** 오래된 날부터 오늘까지, 하루도 빠짐없이 */
  daily: DailyStat[];
  /** 들어온 경로 — 많은 순 */
  sources: { label: string; count: number }[];
  /** 많이 열린 공고 — 많은 순, 최대 5개 */
  topJobs: { id: string; title: string; count: number }[];
};

type Raw = {
  daily: { date: string; views: number; members: number; requests: number }[];
  sources: { source: string; count: number }[];
  top_jobs: { id: number; title: string; count: number }[];
};

/** 현황 숫자. 아직 supabase/page-views.sql 을 실행하지 않았으면 null */
export async function getSiteStats(today: string): Promise<SiteStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_site_stats", { p_from: addDays(today, -(STATS_DAYS - 1)) });
  if (error) {
    console.error("현황 숫자를 불러오지 못했습니다:", error.message);
    return null;
  }
  const raw = data as Raw;
  return {
    daily: raw.daily.map((d) => ({ date: d.date, views: d.views, members: d.members, requests: d.requests })),
    sources: raw.sources.map((s) => ({
      label: SOURCE_LABELS[s.source as Exclude<Source, "internal">] ?? s.source,
      count: s.count,
    })),
    topJobs: raw.top_jobs.map((j) => ({ id: String(j.id), title: j.title, count: j.count })),
  };
}
