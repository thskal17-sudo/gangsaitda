import { z } from "zod";
import { todayInSeoul } from "@/lib/date";
import type { MyRequest } from "@/lib/my-requests";

/*
 * 기관 담당자가 쓰는 강사 모집 공고 입력 규칙. 화면(바로 안내)과 서버(최종 확인)가 같은 규칙을 쓴다.
 * 칸 길이 제한은 데이터베이스(supabase/request-postings.sql)와 같다.
 * 기관명·지역·일정·대상·인원은 의뢰에서 가져오므로 여기서는 받지 않는다.
 */

const required = (label: string, max: number) =>
  z.string().trim().min(1, `${label}을(를) 입력해 주세요.`).max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

const optional = (label: string, max: number) =>
  z.string().trim().max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

export const postingSchema = z.object({
  title: required("공고 제목", 200),
  deadline: z
    .string()
    .min(1, "마감일을 골라 주세요.")
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)), "마감일을 확인해 주세요.")
    .refine((value) => value >= todayInSeoul(), "마감일은 오늘 이후여야 해요."),
  description: required("공고 내용", 5000),
  qualifications: optional("지원 자격", 2000),
  documents: optional("제출 서류", 500),
});

export type PostingInput = z.infer<typeof postingSchema>;

/** 처음 쓸 때 의뢰 내용으로 미리 채워 두는 글. 담당자가 고쳐 쓰면 된다. */
export function prefillPosting(request: MyRequest): PostingInput {
  const lines = [
    "■ 수업 내용",
    request.subject,
    "",
    "■ 수업 일정",
    request.schedule,
    ...(request.target ? ["", "■ 수업 대상", request.target] : []),
    ...(request.budget ? ["", "■ 강사료", request.budget] : []),
    ...(request.message ? ["", "■ 요청 사항", request.message] : []),
  ];
  return {
    title: `${request.orgName} ${request.subject} 강사 모집`.slice(0, 200),
    deadline: "",
    description: lines.join("\n"),
    qualifications: "",
    documents: "",
  };
}
