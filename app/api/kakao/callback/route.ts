import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/admin";
import { KAKAO_STATE_COOKIE, connectKakao } from "@/lib/kakao";
import { SITE_URL } from "@/lib/site";

/**
 * 카카오 로그인(동의)을 마치고 돌아오는 곳. 카카오 개발자 앱의 Redirect URI 에 이 주소가 등록돼 있어야 한다.
 * 관리자인지, state 가 연결을 시작할 때 적어 둔 값과 같은지 확인한 뒤 토큰을 받아 저장한다.
 */
export async function GET(request: Request) {
  const back = (query: string) => NextResponse.redirect(`${SITE_URL}/admin/kakao?${query}`);
  if ((await getAdminStatus()) !== "admin") return back("failed=admin");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get(KAKAO_STATE_COOKIE)?.value;
  cookieStore.delete(KAKAO_STATE_COOKIE);

  if (url.searchParams.get("error")) return back("failed=denied");
  if (!code || !state || !expected || state !== expected) return back("failed=state");

  try {
    await connectKakao(code);
  } catch (err) {
    console.error("[kakao] 연결 실패", err instanceof Error ? err.message : err);
    return back("failed=connect");
  }
  return back("connected=1");
}
