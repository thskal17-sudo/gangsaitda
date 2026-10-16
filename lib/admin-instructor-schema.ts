import { z } from "zod";
import { PROFILE_FIELDS, PROFILE_REGIONS } from "@/lib/profile-schema";

/*
 * 운영자가 직접 등록하는 강사 (사이트에 가입하지 않은 강사). 화면과 서버가 함께 쓰는 입력 규칙.
 * 데이터베이스 규칙(supabase/admin-instructors.sql)과 같다.
 */

export const adminInstructorSchema = z.object({
  name: z.string().trim().min(1, "강사님 이름을 입력해 주세요.").max(50, "이름은 50자까지 입력할 수 있어요."),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^0\d{8,10}$/, "전화번호를 숫자로 입력해 주세요. 예) 010-1234-5678")),
  email: z
    .string()
    .trim()
    .max(200, "이메일은 200자까지 입력할 수 있어요.")
    .refine((v) => v === "" || z.email().safeParse(v).success, "이메일 주소를 확인해 주세요."),
  fields: z.array(z.enum(PROFILE_FIELDS)).min(1, "강의 분야를 하나 이상 골라 주세요."),
  regions: z.array(z.enum(PROFILE_REGIONS)).min(1, "활동 가능 지역을 하나 이상 골라 주세요."),
  consentNote: z.string().trim().max(200, "200자까지 입력할 수 있어요."),
  consentAgreed: z.literal(true, "강사님께 기관 전달 동의를 받았는지 확인해 주세요."),
});

/** 화면에서 넣는 값 (전화번호는 하이픈이 섞여 있어도 된다) */
export type AdminInstructorFormValues = z.input<typeof adminInstructorSchema>;
/** 확인을 통과한 값 (전화번호는 숫자만) */
export type AdminInstructorInput = z.output<typeof adminInstructorSchema>;
