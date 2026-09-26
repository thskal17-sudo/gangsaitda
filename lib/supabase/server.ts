import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * 서버(화면 그리기·서버 액션)에서 쓰는 Supabase 연결.
 * 로그인 정보는 브라우저 쿠키에 들어 있으므로, 요청마다 새로 만든다.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 화면을 그리는 중에는 쿠키를 쓸 수 없다. 로그인 연장은 proxy.ts 가 대신 한다.
        }
      },
    },
  });
}
