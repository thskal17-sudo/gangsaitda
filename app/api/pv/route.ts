import { createClient } from "@supabase/supabase-js";
import { classifySource, isBot, normalizeCampaign, normalizeHost, shouldCount } from "@/lib/page-view";
import { supabaseEnvOrNull } from "@/lib/supabase/env";

/*
 * 화면 열람 한 번을 적는 '받는 문'. 브라우저가 화면을 열 때마다 부른다 (components/page-view-tracker.tsx).
 *
 *   POST /api/pv   { "path": "/jobs/123", "ref": "search.naver.com", "from": "블로그1", "utm_source": "", "utm_campaign": "" }
 *   (ref·from·utm_* 는 처음 들어온 화면에서만)
 *
 * IP 주소·쿠키·회원 정보는 쓰지 않는다. 적는 것은 화면 주소와 들어온 경로(종류·사이트 이름·홍보 링크 이름표)뿐이다.
 * 실패해도 사이트 이용에는 아무 영향이 없게, 언제나 빈 '204' 로 답한다.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  const env = supabaseEnvOrNull();
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!env || isBot(userAgent)) return done;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return done;
  }
  if (typeof body !== "object" || body === null) return done;
  const text = (key: string, max = 100) => (typeof body[key] === "string" ? (body[key] as string).slice(0, max) : null);
  // 200자가 넘는 주소는 shouldCount 가 걸러 내도록 한 글자 더 읽는다.
  const path = text("path", 201) ?? "";
  if (!shouldCount(path)) return done;

  // ref 가 없으면(null) 사이트 안에서 옮겨 간 것, 빈 글자면 이전 주소 없이 들어온 것
  const ref = text("ref");
  const source = ref === null ? "internal" : classifySource(ref, new URL(request.url).hostname, userAgent);
  const isEntry = source !== "internal";

  const supabase = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.rpc("record_page_view", {
    p_path: path,
    p_source: source,
    p_ref_host: isEntry && ref ? normalizeHost(ref) : null,
    p_campaign: isEntry ? normalizeCampaign(text("from"), text("utm_source"), text("utm_campaign")) || null : null,
  });
  if (error) console.error("열람 기록 실패:", error.message);
  return done;
}
