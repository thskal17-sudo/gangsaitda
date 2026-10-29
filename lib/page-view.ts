/*
 * 화면 열람 수 세기 (운영자 현황 화면용). 누가 왔는지는 적지 않고, '어느 화면이 · 어디서 와서' 열렸는지만 센다.
 * 브라우저(components/page-view-tracker.tsx) → /api/pv → Supabase page_views 표 (supabase/page-views.sql).
 */

/** 들어온 경로. 'internal' 은 사이트 안에서 다른 화면으로 옮겨 간 것 (들어온 경로 통계에서는 뺀다). */
export const SOURCES = ["internal", "direct", "naver", "google", "daum", "kakao", "bing", "sns", "other"] as const;
export type Source = (typeof SOURCES)[number];

/** 현황 화면에 보이는 이름 */
export const SOURCE_LABELS: Record<Exclude<Source, "internal">, string> = {
  direct: "직접 입력·즐겨찾기",
  naver: "네이버",
  google: "구글",
  daum: "다음",
  kakao: "카카오톡",
  bing: "빙",
  sns: "SNS (인스타·페북 등)",
  other: "다른 사이트",
};

const HOST_RULES: [RegExp, Source][] = [
  [/(^|\.)naver\.(com|me)$/, "naver"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)daum\.net$/, "daum"],
  [/(^|\.)kakao\.com$/, "kakao"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(instagram\.com|facebook\.com|threads\.net|t\.co|x\.com|twitter\.com|youtube\.com|band\.us)$/, "sns"],
];

/**
 * 처음 들어온 화면의 경로를 정한다.
 * 카카오톡 안에서 링크를 누르면 이전 주소가 비어 있는 경우가 많아, 브라우저 이름(KAKAOTALK)으로 알아본다.
 */
export function classifySource(referrerHost: string, siteHost: string, userAgent: string): Source {
  const host = referrerHost.toLowerCase();
  if (/KAKAOTALK/i.test(userAgent)) return "kakao";
  if (!host) return "direct";
  if (host === siteHost.toLowerCase() || host === `www.${siteHost.toLowerCase()}`) return "internal";
  for (const [rule, source] of HOST_RULES) if (rule.test(host)) return source;
  return "other";
}

/** 검색엔진 로봇 등 사람이 아닌 방문은 세지 않는다. */
export function isBot(userAgent: string): boolean {
  return !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|yeti/i.test(userAgent);
}

/** 운영자 화면·내부 주소는 세지 않는다. */
export function shouldCount(path: string): boolean {
  return path.startsWith("/") && path.length <= 200 && !/^\/(admin|api)(\/|$)/.test(path);
}
