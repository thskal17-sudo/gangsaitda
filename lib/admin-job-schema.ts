import { z } from "zod";
import { todayInSeoul } from "@/lib/date";

/*
 * 관리자 · 공고 등록 입력 규칙. 화면(바로 안내)과 서버(최종 확인)가 같은 규칙을 쓴다.
 * 칸 이름·뜻은 supabase/jobs.sql 과 같다.
 */

const required = (label: string, max: number) =>
  z.string().trim().min(1, `${label}을(를) 입력해 주세요.`).max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

const optional = (label: string, max: number) =>
  z.string().trim().max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

const link = (label: string) =>
  optional(label, 500).refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), `${label}는 https:// 로 시작해야 합니다.`);

export const jobSchema = z.object({
  title: required("제목", 200),
  organization: required("기관명", 100),
  region: required("지역", 50),
  deadline: z
    .string()
    .min(1, "마감일을 골라 주세요.")
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)), "마감일을 확인해 주세요."),
  schedule: required("수업 일정", 500),
  target: optional("수업 대상", 200),
  headcount: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,3}$/.test(value) && +value >= 1), "모집 인원은 1~999 사이 숫자로 입력해 주세요."),
  description: required("상세 내용", 5000),
  qualifications: optional("지원 자격", 2000),
  documents: optional("제출 서류", 500),
  sourceUrl: link("원문 공고 주소"),
  applyUrl: link("지원서 링크"),
  applyEmail: z
    .string()
    .trim()
    .max(100, "이메일은 100자까지 입력할 수 있습니다.")
    .refine((value) => value === "" || z.email().safeParse(value).success, "이메일 주소 형식이 아닙니다. 예) job@example.com"),
});

export type JobInput = z.infer<typeof jobSchema>;

/**
 * 새 공고는 마감일이 오늘 이후여야 한다.
 * (고칠 때는 이미 마감된 공고의 다른 칸도 고칠 수 있게 이 확인을 하지 않는다.)
 */
export const newJobSchema = jobSchema.refine((v) => v.deadline === "" || v.deadline >= todayInSeoul(), {
  message: "마감일이 이미 지났어요.",
  path: ["deadline"],
});
