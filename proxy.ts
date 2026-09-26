import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnvOrNull } from "@/lib/supabase/env";

/**
 * 화면을 열 때마다 먼저 실행된다. 로그인 유지 기간이 끝나가면 Supabase 에서 새로 받아
 * 쿠키에 적어 둔다. 이게 없으면 한동안 뒤에 저절로 로그아웃된 것처럼 보인다.
 * 누구를 막거나 다른 화면으로 보내는 일은 하지 않는다 (그건 각 화면이 한다).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabaseEnvOrNull();
  // 접속 정보를 아직 넣지 않았어도 사이트 전체가 멈추지 않게, 이때는 그냥 지나간다.
  if (!env) return response;
  const { url, key } = env;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // 로그인 확인. 필요하면 이 과정에서 로그인 정보가 새로 발급되어 위 setAll 로 쿠키에 적힌다.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // 그림·글꼴 같은 파일에는 실행하지 않는다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
