import { z } from "zod";

/*
 * 회원가입·로그인 입력 규칙. 화면(바로 안내)과 서버(최종 확인)가 같은 규칙을 쓴다.
 */

/** 연락처에서 숫자만 남긴다. "010-1234-5678" → "01012345678" */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

const email = z
  .string()
  .trim()
  .min(1, "이메일을 입력해 주세요.")
  .pipe(z.email("이메일 주소 형식이 아닙니다. 예) name@example.com"));

export const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30, "이름은 30자까지 입력할 수 있습니다."),
  phone: z
    .string()
    .trim()
    .min(1, "연락처를 입력해 주세요.")
    .refine(
      (value) => /^[\d\s-]+$/.test(value) && /^0\d{8,10}$/.test(phoneDigits(value)),
      "연락처를 확인해 주세요. 예) 010-1234-5678",
    ),
  email,
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상으로 입력해 주세요.")
    .max(72, "비밀번호는 72자까지 입력할 수 있습니다."),
  privacyAgreed: z.literal(true, "개인정보 수집·이용에 동의해야 가입할 수 있습니다."),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** 서버에서 돌려주는 결과. 성공하면 서버가 바로 다음 화면으로 보내므로 실패만 담는다. */
export type AuthResult = { error: string } | undefined;
