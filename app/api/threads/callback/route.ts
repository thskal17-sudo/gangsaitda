import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/admin";
import { THREADS_STATE_COOKIE, connectThreads } from "@/lib/threads";
import { SITE_URL } from "@/lib/site";

/**
 * Threads 로그인(권한 동의)을 마치고 돌아오는 곳. Meta 개발자 앱의 '리디렉션 콜백 URL'에 이 주소가 등록돼 있어야 한다.
 * 관리자인지, state 가 연결을 시작할 때 적어 둔 값과 같은지 확인한 뒤 토큰을 받아 저장한다.
 */
export async function GET(request: Request) {
  const back = (query: string) => NextResponse.redirect(`${SITE_URL}/admin/threads?${query}`);
  if ((await getAdminStatus()) !== "admin") return back("failed=admin");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get(THREADS_STATE_COOKIE)?.value;
  cookieStore.delete(THREADS_STATE_COOKIE);

  if (url.searchParams.get("error")) return back("failed=denied");
  if (!code || !state || !expected || state !== expected) return back("failed=state");

  try {
    await connectThreads(code);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error("[threads] 연결 실패", why);
    // 이유를 화면에 보여준다 (Meta 오류 문구). 열쇠 값은 들어 있지 않다.
    return back(`failed=connect&why=${encodeURIComponent(why.slice(0, 160))}`);
  }
  return back("connected=1");
}
