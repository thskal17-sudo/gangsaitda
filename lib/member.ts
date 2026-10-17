import { cache } from "react";
import type { MemberType } from "@/lib/auth-schema";
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

/**
 * 지금 회원의 종류(강사 / 기관). 비회원이거나 아직 알 수 없으면 null.
 * null 이면 화면은 예전처럼 강사·기관 메뉴를 모두 보여준다
 * (supabase/member-type.sql 을 아직 실행하지 않았을 때도 사이트가 멈추지 않게).
 */
export const getMemberType = cache(async (): Promise<MemberType | null> => {
  const member = await getCurrentMember();
  if (!member) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("members").select("member_type").eq("id", member.id).maybeSingle();
  if (error) {
    console.error("[member] 회원 종류 읽기 실패", error.code, error.message);
    return null;
  }
  const type = (data as { member_type: string } | null)?.member_type;
  return type === "강사" || type === "기관" ? type : null;
});
