"use server";

import { after } from "next/server";
import { phoneDigits } from "@/lib/auth-schema";
import { sendKakaoToMe } from "@/lib/kakao";
import { getCurrentMember } from "@/lib/member";
import { requestSchema } from "@/lib/request-schema";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/*
 * 강사섭외 의뢰 보내기. 로그인한 회원만 보낼 수 있다 (데이터베이스도 회원만 받는다:
 * supabase/instructor-requests-change-2.sql). 보낸 의뢰는 관리자 화면(/admin/requests)에서만 본다.
 * 저장이 끝나면 운영자 카톡으로 알림을 보낸다 (lib/kakao.ts). 알림이 실패해도 의뢰는 그대로 저장된다.
 */
export async function sendRequest(input: unknown): Promise<{ ok: true } | { error: string }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (!(await getCurrentMember())) {
    return { error: "로그인이 풀렸습니다. 다시 로그인한 뒤 보내 주세요." };
  }

  // 숨은 칸이 채워져 있으면 사람이 아니라 자동 프로그램이다. 저장하지 않고 성공한 척한다.
  if (v.website) return { ok: true };

  const blankToNull = (value: string) => (value === "" ? null : value);

  const supabase = await createClient();
  const { error } = await supabase.from("instructor_requests").insert({
    org_name: v.orgName,
    org_type: v.orgType,
    region: v.region,
    contact_name: v.contactName,
    contact_phone: phoneDigits(v.contactPhone),
    contact_email: v.contactEmail,
    subject: v.subject,
    schedule: v.schedule,
    target: blankToNull(v.target),
    headcount: v.headcount === "" ? null : Number(v.headcount),
    budget: blankToNull(v.budget),
    message: blankToNull(v.message),
  });

  if (error) {
    console.error("[request] 강사섭외 의뢰 저장 실패", error.code, error.message);
    return { error: "의뢰를 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  // 응답을 먼저 보내고 난 뒤에 카톡 알림을 보낸다 (의뢰 보내기 화면이 기다리지 않게)
  after(async () => {
    const text = [
      `[강사잇다] 새 강사섭외 의뢰`,
      `기관: ${v.orgName} (${v.orgType} · ${v.region})`,
      `분야: ${v.subject}`,
      `일정: ${v.schedule}`,
      `담당자: ${v.contactName} ${v.contactPhone}`,
    ].join("\n");
    await sendKakaoToMe(text, `${SITE_URL}/admin/requests`);
  });
  return { ok: true };
}
