/*
 * 화면 열람 수 세기 (운영자 현황 화면용). 누가 왔는지는 적지 않고, '어느 화면이 · 어디서 와서' 열렸는지만 센다.
 * 브라우저(components/page-view-tracker.tsx) → /api/pv → Supabase page_views 표 (supabase/page-views.sql).
 *
 * 어디서 왔는지는 세 가지로 적는다 (처음 들어온 화면에서만).
 * - 경로 종류: 네이버 블로그·인스타그램 같은 묶음 (아래 SOURCE_LABELS)
 * - 사이트 이름: 이전 주소의 사이트 이름만. 예: "blog.naver.com" (주소 전체·검색어는 적지 않음)
 * - 홍보 링크 이름표: 주소 끝의 ?from=이름 (또는 광고에서 쓰는 utm_source)
 */

/** 경로 종류별 이름. 'internal' 은 사이트 안에서 다른 화면으로 옮겨 간 것 (들어온 경로 통계에서는 뺀다). */
export const SOURCE_LABELS: Record<string, string> = {
  direct: "직접 입력·즐겨찾기",
  naver_search: "네이버 검색",
  naver_blog: "네이버 블로그",
  naver_cafe: "네이버 카페",
  naver_app: "네이버 앱",
  naver_other: "네이버 (기타)",
  google: "구글",
  daum_search: "다음 검색",
  daum_cafe: "다음 카페",
  daum_app: "다음 앱",
  daum_other: "다음 (기타)",
  tistory: "티스토리 블로그",
  kakao: "카카오톡",
  bing: "빙",
  instagram: "인스타그램",
  facebook: "페이스북",
  band: "밴드",
  youtube: "유튜브",
  threads: "스레드",
  x: "X(트위터)",
  line: "라인",
  sns: "기타 SNS",
  other: "다른 사이트",
  // 예전 판(2026-10-29~30)에 적힌 묶음. 그 무렵 기록에만 있다.
  naver: "네이버 (자세히 나누기 전)",
  daum: "다음 (자세히 나누기 전)",
};

export type Source = keyof typeof SOURCE_LABELS | "internal";

/** 사이트 이름 → 경로 종류. 위에서부터 처음 맞는 것. */
const HOST_RULES: [RegExp, string][] = [
  [/^(m\.)?search\.naver\.com$/, "naver_search"],
  [/^(m\.)?blog\.naver\.com$|(^|\.)blog\.me$/, "naver_blog"],
  [/^(m\.)?cafe\.naver\.com$/, "naver_cafe"],
  [/^com\.nhn\.android\.search$/, "naver_app"],
  [/(^|\.)naver\.(com|me|net)$/, "naver_other"],
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android\./, "google"],
  [/^(m\.)?search\.daum\.net$/, "daum_search"],
  [/^(m\.)?cafe\.daum\.net$/, "daum_cafe"],
  [/^net\.daum\.android\./, "daum_app"],
  [/(^|\.)daum\.net$/, "daum_other"],
  [/(^|\.)tistory\.com$/, "tistory"],
  [/(^|\.)kakao\.com$/, "kakao"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)band\.us$/, "band"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
  [/(^|\.)line\.me$/, "line"],
];

/**
 * 이전 주소가 없을 때, 휴대폰 앱 안의 브라우저인지 브라우저 이름으로 알아본다.
 * (앱 안에서 링크를 누르면 이전 주소가 지워지는 경우가 많다.)
 */
const APP_RULES: [RegExp, string][] = [
  [/KAKAOTALK/i, "kakao"],
  [/NAVER\(inapp|NAVER\/\d/i, "naver_app"],
  [/DaumApps/i, "daum_app"],
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB/i, "facebook"],
  [/BAND\//i, "band"],
  [/Line\//, "line"],
  [/Barcelona/i, "threads"],
];

/** 사이트 이름을 묶기 좋게 다듬는다: 소문자, 앞의 "www."·"m."(휴대폰판) 빼기. 예: "m.blog.naver.com" → "blog.naver.com" */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^(www|m)\./, "").slice(0, 100);
}

/** 처음 들어온 화면의 경로 종류를 정한다. 이전 주소가 있으면 그 사이트로, 없으면 앱 이름으로. */
export function classifySource(referrerHost: string, siteHost: string, userAgent: string): string {
  const host = normalizeHost(referrerHost);
  if (host) {
    if (host === normalizeHost(siteHost)) return "internal";
    for (const [rule, source] of HOST_RULES) if (rule.test(host)) return source;
    return "other";
  }
  for (const [rule, source] of APP_RULES) if (rule.test(userAgent)) return source;
  return "direct";
}

/**
 * 홍보 링크 이름표를 다듬는다. ?from=블로그1 이 먼저, 없으면 utm_source(+ utm_campaign).
 * 글자·숫자·- _ . / 공백만 남기고 50자까지.
 */
export function normalizeCampaign(from: string | null, utmSource: string | null, utmCampaign: string | null): string {
  const raw = from || (utmSource ? (utmCampaign ? `${utmSource}/${utmCampaign}` : utmSource) : "");
  return raw.replace(/[^\p{L}\p{N}\-_./ ]/gu, "").trim().slice(0, 50);
}

/** 검색엔진 로봇 등 사람이 아닌 방문은 세지 않는다. */
export function isBot(userAgent: string): boolean {
  return !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|yeti/i.test(userAgent);
}

/** 운영자 화면·내부 주소는 세지 않는다. */
export function shouldCount(path: string): boolean {
  return path.startsWith("/") && path.length <= 200 && !/^\/(admin|api)(\/|$)/.test(path);
}
