import { addDays, daysBetween, mondayOf, seoulDateOf } from "@/lib/date";
import { classifySource, SOURCE_LABELS } from "@/lib/page-view";
import { createClient } from "@/lib/supabase/server";

/*
 * 관리자 · 현황(대시보드) 숫자. 데이터베이스 함수 admin_site_stats 가 관리자인지 확인하고
 * 날짜별 열람 수·새 가입자 수·새 의뢰 수, 들어온 경로·사이트·홍보 링크, 많이 본 공고를 한 번에 돌려준다 (supabase/page-views.sql).
 */

/** 고를 수 있는 기간 (오늘 포함 날 수). 첫째 값이 아니라 DEFAULT_DAYS 가 기본. */
export const PERIODS = [7, 14, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_DAYS: Period = 14;

export function toPeriod(value: string | string[] | undefined): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : DEFAULT_DAYS;
}

export type DailyStat = { date: string; views: number; members: number; requests: number };

export type SiteStats = {
  /** 오래된 날부터 오늘까지, 하루도 빠짐없이 */
  daily: DailyStat[];
  /** 들어온 경로 종류 — 많은 순 */
  sources: { label: string; count: number }[];
  /** 들어온 사이트 이름 — 많은 순, 최대 20개. kind 는 그 사이트의 경로 종류 이름 */
  hosts: { host: string; kind: string; count: number }[];
  /** 홍보 링크 이름표 — 많은 순, 최대 20개 */
  campaigns: { name: string; count: number }[];
  /** 많이 열린 공고 — 많은 순, 최대 5개 */
  topJobs: { id: string; title: string; count: number }[];
};

type Raw = {
  daily: { date: string; views: number; members: number; requests: number }[];
  sources: { source: string; count: number }[];
  // 예전 판 SQL 에는 없다.
  hosts?: { host: string; count: number }[];
  campaigns?: { name: string; count: number }[];
  top_jobs: { id: number; title: string; count: number }[];
};

/** 현황 숫자 (오늘까지 days 일). 아직 supabase/page-views.sql 을 실행하지 않았으면 null */
export async function getSiteStats(today: string, days: Period): Promise<SiteStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_site_stats", { p_from: addDays(today, -(days - 1)) });
  if (error) {
    console.error("현황 숫자를 불러오지 못했습니다:", error.message);
    return null;
  }
  const raw = data as Raw;
  return {
    daily: raw.daily.map((d) => ({ date: d.date, views: d.views, members: d.members, requests: d.requests })),
    sources: raw.sources.map((s) => ({ label: SOURCE_LABELS[s.source] ?? s.source, count: s.count })),
    hosts: (raw.hosts ?? []).map((h) => ({ host: h.host, kind: SOURCE_LABELS[classifySource(h.host, "", "")] ?? "", count: h.count })),
    campaigns: raw.campaigns ?? [],
    topJobs: raw.top_jobs.map((j) => ({ id: String(j.id), title: j.title, count: j.count })),
  };
}

/*
 * 가입자·강사섭외 의뢰 추이 — 첫 기록부터 오늘까지.
 * 가입한 시각(members)·의뢰를 받은 시각(instructor_requests)은 관리자만 읽을 수 있다
 * (supabase/admin-members.sql, admin-requests.sql). 시각만 읽고 이름·연락처는 읽지 않는다.
 */

/** 막대 하나가 묶는 기간. 기간이 길면 하루 → 한 주 → 한 달로 묶어 막대 수를 줄인다. */
export type GrowthUnit = "day" | "week" | "month";

export type GrowthBucket = {
  /** 기간의 첫날. 예: 하루 "2026-10-29", 한 주 "2026-10-26"(월), 한 달 "2026-10-01" */
  start: string;
  members: number;
  requests: number;
};

export type Growth = {
  unit: GrowthUnit;
  buckets: GrowthBucket[];
  totalMembers: number;
  totalRequests: number;
};

/** 하루 단위로 보여 주는 최대 날 수, 한 주 단위로 보여 주는 최대 주 수 */
const MAX_DAY_BARS = 45;
const MAX_WEEK_BARS = 60;

/** 한 번에 1000줄까지만 오므로 나눠서 모두 읽는다. */
async function readAllCreatedDates(table: "members" | "instructor_requests"): Promise<string[]> {
  const supabase = await createClient();
  const PAGE = 1000;
  const dates: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("created_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`추이를 불러오지 못했습니다 (${table}): ${error.message}`);
    dates.push(...(data as { created_at: string }[]).map((row) => seoulDateOf(row.created_at)));
    if (data.length < PAGE) return dates;
  }
}

function bucketStart(date: string, unit: GrowthUnit): string {
  if (unit === "week") return mondayOf(date);
  if (unit === "month") return `${date.slice(0, 7)}-01`;
  return date;
}

function nextBucket(start: string, unit: GrowthUnit): string {
  if (unit === "day") return addDays(start, 1);
  if (unit === "week") return addDays(start, 7);
  const [year, month] = start.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** 가입자·의뢰 추이. 기록이 하나도 없으면 null */
export async function getGrowth(today: string): Promise<Growth | null> {
  const [members, requests] = await Promise.all([readAllCreatedDates("members"), readAllCreatedDates("instructor_requests")]);
  const first = [members[0], requests[0]].filter(Boolean).sort()[0];
  if (!first) return null;

  const span = daysBetween(first, today) + 1;
  const unit: GrowthUnit = span <= MAX_DAY_BARS ? "day" : span <= MAX_WEEK_BARS * 7 ? "week" : "month";

  // 기록이 없는 기간도 0 으로 빠짐없이 채운다.
  const buckets = new Map<string, GrowthBucket>();
  const end = bucketStart(today, unit);
  for (let start = bucketStart(first, unit); start <= end; start = nextBucket(start, unit)) {
    buckets.set(start, { start, members: 0, requests: 0 });
  }
  for (const date of members) {
    const b = buckets.get(bucketStart(date, unit));
    if (b) b.members += 1;
  }
  for (const date of requests) {
    const b = buckets.get(bucketStart(date, unit));
    if (b) b.requests += 1;
  }

  return { unit, buckets: [...buckets.values()], totalMembers: members.length, totalRequests: requests.length };
}
