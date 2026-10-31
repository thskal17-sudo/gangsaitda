import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/admin";
import { THREADS_STATE_COOKIE, threadsAuthorizeUrl } from "@/lib/threads";
import { SITE_URL } from "@/lib/site";

/**
 * 관리자 · 'Threads 연결' 버튼. 관리자만 누를 수 있고, Threads 로그인(권한 동의) 화면으로 보낸다.
 * state 값을 쿠키에 적어 두고 돌아올 때(callback) 같은지 확인한다 (남이 만든 주소로 연결되는 것을 막음).
 */
export async function GET() {
  if ((await getAdminStatus()) !== "admin") {
    return NextResponse.redirect(`${SITE_URL}/admin/threads?failed=admin`);
  }
  const state = randomBytes(16).toString("hex");
  const url = threadsAuthorizeUrl(state);
  if (!url) return NextResponse.redirect(`${SITE_URL}/admin/threads?failed=key`);

  const cookieStore = await cookies();
  cookieStore.set(THREADS_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/threads",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(url);
}
