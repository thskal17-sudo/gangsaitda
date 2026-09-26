import { createClient } from "@/lib/supabase/server";

/** 로그인한 회원. 필요한 정보가 생기면 여기에 더한다. */
export type Member = {
  id: string;
};

/** 지금 화면을 보는 사람이 회원인지 확인한다. 회원이 아니면 null. */
export async function getCurrentMember(): Promise<Member | null> {
  const supabase = await createClient();
  // getClaims 는 로그인 쿠키가 위조되지 않았는지 서명까지 확인한다.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub };
}
