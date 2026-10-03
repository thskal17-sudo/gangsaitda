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

/** 비밀번호 규칙 (가입·새 비밀번호 함께 씀) */
const password = z
  .string()
  .min(8, "비밀번호는 8자 이상으로 입력해 주세요.")
  .max(72, "비밀번호는 72자까지 입력할 수 있습니다.");

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
  password,
  privacyAgreed: z.literal(true, "개인정보 수집·이용에 동의해야 가입할 수 있습니다."),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** 이메일(아이디) 찾기: 가입할 때 적은 이름·연락처 */
export const findEmailSchema = signupSchema.pick({ name: true, phone: true });

export type FindEmailInput = z.infer<typeof findEmailSchema>;

/** 비밀번호 찾기: 가입한 이메일로 재설정 메일 받기 */
export const resetRequestSchema = z.object({ email });

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

/** 새 비밀번호: 같은 걸 두 번 입력 */
export const newPasswordSchema = z
  .object({
    password,
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해 주세요."),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "두 비밀번호가 다릅니다. 같게 입력해 주세요.",
    path: ["passwordConfirm"],
  });

export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** 회원 탈퇴: 본인 확인용 비밀번호 + 되돌릴 수 없다는 안내 확인 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
  confirmed: z.literal(true, "안내를 확인했다고 체크해 주세요."),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** 서버에서 돌려주는 결과. 성공하면 서버가 바로 다음 화면으로 보내므로 실패만 담는다. */
export type AuthResult = { error: string } | undefined;
