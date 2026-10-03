"use server";

import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  type AuthResult,
  deleteAccountSchema,
  findEmailSchema,
  loginSchema,
  newPasswordSchema,
  phoneDigits,
  resetRequestSchema,
  signupSchema,
} from "@/lib/auth-schema";
import { NEW_PASSWORD_PATH, RECOVERY_COOKIE, type RecoveryToken } from "@/lib/recovery";
import { removeProfileFiles } from "@/lib/profile";
import { safeNext } from "@/lib/safe-next";
import { SITE_URL } from "@/lib/site";
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

  refreshAllScreens();
  redirect(safeNext(next));
}

export async function login(input: unknown, next: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: loginErrorMessage(error) };

  refreshAllScreens();
  redirect(safeNext(next));
}

/** 로그아웃. 보던 화면에 그대로 머물고, 회원 전용 내용만 사라진다. */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  refreshAllScreens();
}

/**
 * 회원 탈퇴. 비밀번호로 본인인지 한 번 더 확인한 뒤, 데이터베이스 함수(supabase/delete-account.sql)로
 * 자기 계정을 지운다. 회원 정보(members)도 함께 지워진다. 성공하면 로그아웃된 채 홈으로 간다.
 */
export async function deleteAccount(input: unknown): Promise<AuthResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = claims?.claims.email;
  if (!email) return { error: "로그인이 풀렸습니다. 다시 로그인한 뒤 탈퇴해 주세요." };

  // 본인 확인: 지금 로그인한 계정의 이메일 + 입력한 비밀번호가 맞는지
  const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (checkError) {
    return {
      error: checkError.code === "invalid_credentials" ? "비밀번호가 맞지 않습니다." : commonErrorMessage(checkError, "본인 확인을 하지 못했습니다."),
    };
  }

  // 강사 프로필 파일은 계정과 함께 지워지지 않으므로 먼저 지운다 (프로필 줄은 데이터베이스가 함께 지운다).
  const userId = claims?.claims.sub;
  if (userId) await removeProfileFiles(userId).catch((e) => console.error("[account] 프로필 파일 삭제 실패", e));

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[account] 회원 탈퇴 실패", error.code, error.message);
    return { error: "탈퇴를 처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  // 계정이 지워졌으니 이 브라우저의 로그인 기록(쿠키)도 지운다.
  await supabase.auth.signOut({ scope: "local" });
  refreshAllScreens();
  redirect("/?deleted=1");
}

/**
 * 로그인 상태가 바뀌었으니 위쪽 띠의 로그인/로그아웃 버튼과
 * 회원 전용 내용이 있는 화면을 모두 새로 그리게 한다.
 */
function refreshAllScreens() {
  revalidatePath("/", "layout");
}

/**
 * 이메일(아이디) 찾기. 이름·연락처가 모두 맞는 회원의 이메일을 **가려서** 돌려준다.
 * 가리는 일은 데이터베이스 함수(supabase/find-email.sql)가 하므로 전체 이메일은 여기로 오지 않는다.
 */
export async function findEmail(input: unknown): Promise<{ emails: string[] } | { error: string }> {
  const parsed = findEmailSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, phone } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_member_email", {
    member_name: name,
    member_phone: phoneDigits(phone),
  });
  if (error) {
    console.error("[auth] 이메일 찾기 실패", error.code, error.message);
    return { error: "지금은 이메일을 찾을 수 없습니다. 잠시 뒤에 다시 시도해 주세요." };
  }
  return { emails: data as string[] };
}

/**
 * 비밀번호 찾기: 재설정 메일 보내기. 메일은 Supabase 가 Resend 를 통해 보낸다.
 * 가입하지 않은 이메일이어도 Supabase 가 똑같이 '성공'을 돌려준다. 그래서 화면도 늘 같은 안내를 보여주고,
 * 남이 어떤 이메일이 가입돼 있는지 알아낼 수 없다.
 * 메일 속 링크 모양은 Supabase 의 메일 문구(supabase/email-templates/reset-password.html)가 정한다.
 */
export async function requestPasswordReset(input: unknown): Promise<{ sent: true } | { error: string }> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // 메일 문구를 바꾸기 전(Supabase 기본 문구)에도 같은 화면으로 오게 한다.
    redirectTo: `${SITE_URL}${NEW_PASSWORD_PATH}`,
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: "방금 메일을 보냈습니다. 1분쯤 기다린 뒤 다시 요청해 주세요." };
    }
    return { error: commonErrorMessage(error, "메일을 보내지 못했습니다.") };
  }
  return { sent: true };
}

/**
 * 새 비밀번호 저장. 메일 링크의 값으로 본인 확인 → 비밀번호 바꾸기 → 그대로 로그인된 상태가 된다.
 * 본인 확인을 화면을 열 때가 아니라 '저장'을 누를 때 하는 이유: 일부 메일 서비스가 보안 검사로 링크를
 * 미리 열어 보는데, 열자마자 확인하면 그 검사가 한 번뿐인 링크를 써 버린다.
 */
export async function setNewPassword(input: unknown, token: RecoveryToken): Promise<{ done: true } | { error: string }> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const cookieStore = await cookies();
  const expired = { error: "링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기에서 메일을 다시 받아 주세요." };

  let userId: string | undefined;
  const tokenHash = typeof token?.tokenHash === "string" ? token.tokenHash : undefined;
  const code = typeof token?.code === "string" ? token.code : undefined;
  if (tokenHash) {
    const { data } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    userId = data.user?.id;
  } else if (code) {
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    userId = data.user?.id;
  }

  if (userId) {
    cookieStore.set(RECOVERY_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: NEW_PASSWORD_PATH,
      maxAge: 15 * 60,
    });
  } else {
    // 링크는 이미 쓰였지만, 방금 이 브라우저에서 확인을 마친 그 회원이면 계속 진행한다.
    const { data: claims } = await supabase.auth.getClaims();
    const current = claims?.claims.sub;
    if (!current || cookieStore.get(RECOVERY_COOKIE)?.value !== current) return expired;
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    switch (error.code) {
      case "same_password":
        return { error: "지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요." };
      case "weak_password":
        return { error: "비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 더 길게 만들어 주세요." };
      default:
        return { error: commonErrorMessage(error, "비밀번호를 바꾸지 못했습니다.") };
    }
  }

  cookieStore.delete({ name: RECOVERY_COOKIE, path: NEW_PASSWORD_PATH });
  refreshAllScreens();
  return { done: true };
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
