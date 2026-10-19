import { createClient } from "@/lib/supabase/server";

/*
 * 교육·강의 섭외 소식 문자 수신 동의 (선택). 회원 본인 것만 읽는다 (회원은 자기 정보 한 줄만 읽을 수 있음).
 * 켜고 끄기는 lib/sms-consent-actions.ts → 데이터베이스 함수 set_my_sms_consent (supabase/sms-consent.sql).
 */

export type SmsConsent = {
  agreed: boolean;
  /** 마지막으로 동의·거부를 처리한 시각 (ISO). 한 번도 처리한 적 없으면 null */
  updatedAt: string | null;
};

/** 내 문자 수신 동의 상태. 읽지 못하면 null */
export async function getMySmsConsent(memberId: string): Promise<SmsConsent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("sms_agreed_at, sms_updated_at")
    .eq("id", memberId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[sms] 문자 수신 동의 읽기 실패", error.code, error.message);
    return null;
  }
  const row = data as { sms_agreed_at: string | null; sms_updated_at: string | null };
  return { agreed: row.sms_agreed_at !== null, updatedAt: row.sms_updated_at };
}
