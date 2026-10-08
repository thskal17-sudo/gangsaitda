import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * 사이트 서버만 쓰는 Supabase 연결 (로그인한 사람 없이, 비밀 키로).
 * 회원·관리자의 읽기 규칙(RLS)을 그대로 지나가므로, 꼭 필요한 곳(수집 공고 받기)에서만 쓴다.
 * 비밀 키(SUPABASE_SECRET_KEY)는 Vercel 환경 변수에만 두고 브라우저로는 절대 가지 않는다.
 */
export function createServiceClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  const { url } = supabaseEnv();
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
