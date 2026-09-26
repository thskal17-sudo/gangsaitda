import { z } from "zod";
import { phoneDigits } from "@/lib/auth-schema";

/*
 * 강사섭외 의뢰서 입력 규칙. 화면(바로 안내)과 서버(최종 확인)가 같은 규칙을 쓴다.
 * 칸 길이 제한은 데이터베이스(supabase/instructor-requests.sql)와 맞춘다.
 */

export const ORG_TYPES = ["학교", "공공기관", "기업", "복지관·센터", "기타"] as const;

const required = (label: string, max: number) =>
  z.string().trim().min(1, `${label}을(를) 입력해 주세요.`).max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

const optional = (label: string, max: number) =>
  z.string().trim().max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

export const requestSchema = z.object({
  orgName: required("기관명", 100),
  orgType: z.enum(ORG_TYPES, "기관 종류를 골라 주세요."),
  region: required("지역", 50),
  contactName: required("담당자 이름", 30),
  contactPhone: z
    .string()
    .trim()
    .min(1, "연락처를 입력해 주세요.")
    .refine(
      (value) => /^[\d\s-]+$/.test(value) && /^0\d{8,10}$/.test(phoneDigits(value)),
      "연락처를 확인해 주세요. 예) 010-1234-5678, 051-123-4567",
    ),
  contactEmail: z
    .string()
    .trim()
    .max(100, "이메일은 100자까지 입력할 수 있습니다.")
    .refine((value) => value === "" || z.email().safeParse(value).success, "이메일 주소 형식이 아닙니다."),
  subject: required("필요한 분야·과목", 200),
  schedule: required("희망 일정", 500),
  target: optional("수업 대상", 200),
  headcount: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,3}$/.test(value) && +value >= 1 && +value <= 100), "강사 수는 1~100 사이 숫자로 입력해 주세요."),
  budget: optional("예산", 200),
  message: optional("요청 사항", 2000),
  privacyAgreed: z.literal(true, "개인정보 수집·이용에 동의해야 의뢰를 보낼 수 있습니다."),
  /** 사람 눈에는 안 보이는 칸. 자동으로 글을 올리는 프로그램만 채운다. */
  website: z.string().optional(),
});

export type RequestInput = z.infer<typeof requestSchema>;
