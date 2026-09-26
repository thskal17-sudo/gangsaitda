"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  type AuthResult,
  loginSchema,
  phoneDigits,
  signupSchema,
} from "@/lib/auth-schema";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/*
 * 회원가입·로그인을 실제로 처리하는 서버 쪽 코드.
 * 화면에서 이미 입력을 확인했더라도, 화면을 거치지 않고 들어오는 요청이 있을 수 있어 여기서 다시 확인한다.
 */

export async function signup(input: unknown, next: unknown): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, phone, email, password } = parsed.data;

  const supabase = await createClient();
  // 이름·연락처·동의 여부를 함께 보내면, 데이터베이스가 회원 정보 표(members)에 한 줄을 만든다.
  // (supabase/members.sql 의 handle_new_member 참고. 동의가 없으면 데이터베이스가 가입을 거절한다.)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone: phoneDigits(phone), privacy_agreed: true } },
  });
  if (error) return { error: signupErrorMessage(error) };

  // 'Confirm email'이 켜져 있으면 가입 직후 로그인 상태가 아니다.
  if (!data.session) {
    return { error: "가입 신청이 접수되었습니다. 이메일로 받은 확인 링크를 누른 뒤 로그인해 주세요." };
  }

  redirect(safeNext(next));
}

export async function login(input: unknown, next: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: loginErrorMessage(error) };

  redirect(safeNext(next));
}

function signupErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    case "weak_password":
      return "비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 더 길게 만들어 주세요.";
    case "email_address_invalid":
      return "사용할 수 없는 이메일 주소입니다. 다른 이메일을 입력해 주세요.";
    default:
      return commonErrorMessage(error, "가입하지 못했습니다.");
  }
}

function loginErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 맞지 않습니다.";
    case "email_not_confirmed":
      return "이메일 확인이 아직 안 되었습니다. 받은 메일의 확인 링크를 눌러 주세요.";
    default:
      return commonErrorMessage(error, "로그인하지 못했습니다.");
  }
}

function commonErrorMessage(error: AuthError, what: string): string {
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "잠시 요청이 너무 많았습니다. 1분쯤 뒤에 다시 시도해 주세요.";
  }
  // 어떤 문제인지 운영자가 서버 기록에서 볼 수 있게 남긴다. (비밀번호는 남기지 않는다.)
  console.error(`[auth] ${what}`, error.code, error.status, error.message);
  return `${what} 잠시 뒤에 다시 시도해 주세요.`;
}
