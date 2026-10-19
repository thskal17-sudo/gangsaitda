"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

/** 문자 수신 켜기·끄기. 끝나면 같은 화면으로 돌아가 처리 결과(날짜·내용)를 보여준다. */
export async function setMySmsConsent(agreed: boolean): Promise<void> {
  if (!(await getCurrentMember())) redirect("/login?next=/account/sms");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_sms_consent", { p_agreed: agreed });
  if (error) {
    console.error("[sms] 문자 수신 동의 바꾸기 실패", error.code, error.message);
    redirect("/account/sms?failed=1");
  }
  revalidatePath("/account/sms");
  redirect(`/account/sms?done=${agreed ? "on" : "off"}`);
}
