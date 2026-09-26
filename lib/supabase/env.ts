/**
 * Supabase 접속 정보. 둘 다 브라우저에 보여도 되는 값이다 (비밀 키가 아님).
 * 키 이름은 새 이름(PUBLISHABLE_KEY)을 먼저 보고, 없으면 예전 이름(ANON_KEY)을 본다.
 */
export function supabaseEnvOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** 접속 정보가 없으면 무엇을 넣어야 하는지 알려주며 멈춘다. */
export function supabaseEnv() {
  const env = supabaseEnvOrNull();
  if (!env) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 넣어주세요.",
    );
  }
  return env;
}
