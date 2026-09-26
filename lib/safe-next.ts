/**
 * 가입·로그인 뒤 돌아갈 주소(next)를 고른다.
 * 우리 사이트 안의 주소("/"로 시작)만 받고, 다른 사이트로 보내는 주소는 버린다.
 * 예) "/jobs/3" → 그대로,  "https://나쁜사이트" · "//나쁜사이트" · "/\나쁜사이트" → "/"
 */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // 주소 안에 줄바꿈 같은 보이지 않는 문자가 섞이면 버린다.
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;

  // 브라우저가 실제로 해석하는 방식으로 한 번 더 확인한다.
  const base = "https://gangsaitda.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    const result = `${url.pathname}${url.search}${url.hash}`;
    // "/../..//나쁜사이트" 처럼 정리하고 나면 "//" 로 시작하게 되는 주소도 버린다.
    if (result.startsWith("//") || result.startsWith("/\\")) return fallback;
    return result;
  } catch {
    return fallback;
  }
}
