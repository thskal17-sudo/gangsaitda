import { cache } from "react";
import { supabaseEnvOrNull } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** 로그인한 회원. 필요한 정보가 생기면 여기에 더한다. */
export type Member = {
  id: string;
};

/**
 * 지금 화면을 보는 사람이 회원인지 확인한다. 회원이 아니면 null.
 * 한 화면 안에서 여러 번 불러도(위쪽 띠 + 본문) 실제 확인은 한 번만 한다.
 */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  // Supabase 접속 정보를 아직 넣지 않았으면 모두 비회원으로 본다 (사이트가 멈추지 않게).
  if (!supabaseEnvOrNull()) return null;

  const supabase = await createClient();
  // getClaims 는 로그인 쿠키가 위조되지 않았는지 서명까지 확인한다.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub };
});
