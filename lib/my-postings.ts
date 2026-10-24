import { seoulDateOf } from "@/lib/date";
import type { PostingInput } from "@/lib/posting-schema";
import { createClient } from "@/lib/supabase/server";

/*
 * 기관 담당자 · 내 의뢰의 강사 모집 공고. 데이터베이스 함수가 '내 의뢰인지'를 확인하고 돌려준다
 * (supabase/request-postings.sql 의 my_posting). 쓰기는 lib/my-posting-actions.ts.
 */

export const POSTING_STATUSES = ["검토 중", "승인", "반려"] as const;
export type PostingStatus = (typeof POSTING_STATUSES)[number];

export function isPostingStatus(value: unknown): value is PostingStatus {
  return POSTING_STATUSES.includes(value as PostingStatus);
}

export type MyPosting = {
  values: PostingInput;
  status: PostingStatus;
  /** 반려 사유 (반려된 공고만) */
  reviewNote?: string;
  /** 승인되어 올라간 공고 번호 */
  jobId?: string;
  /** 낸 날 (한국 날짜) */
  submittedDate: string;
  /** 운영자가 처리한 날 (한국 날짜) */
  reviewedDate?: string;
  /** 담당자가 모집을 마감했다 */
  closed: boolean;
};

type Row = {
  title: string;
  deadline: string;
  description: string;
  qualifications: string | null;
  documents: string | null;
  status: string;
  review_note: string | null;
  job_id: number | null;
  submitted_at: string;
  reviewed_at: string | null;
  closed_at: string | null;
};

/** 내 의뢰의 모집 공고. 아직 안 썼거나 내 의뢰가 아니면 null */
export async function getMyPosting(requestId: string): Promise<MyPosting | null> {
  if (!/^\d{1,15}$/.test(requestId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_posting", { p_request_id: Number(requestId) });
  if (error) throw new Error(`모집 공고를 불러오지 못했습니다: ${error.message}`);
  const row = (data as Row[])[0];
  if (!row) return null;
  return {
    values: {
      title: row.title,
      deadline: row.deadline,
      description: row.description,
      qualifications: row.qualifications ?? "",
      documents: row.documents ?? "",
    },
    status: isPostingStatus(row.status) ? row.status : "검토 중",
    reviewNote: row.review_note?.trim() || undefined,
    jobId: row.job_id === null ? undefined : String(row.job_id),
    submittedDate: seoulDateOf(row.submitted_at),
    reviewedDate: row.reviewed_at ? seoulDateOf(row.reviewed_at) : undefined,
    closed: row.closed_at !== null,
  };
}
