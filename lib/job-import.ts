import { toRpcArgs } from "@/lib/admin-job-schema";
import { MAX_ROWS, REQUIRED_COLUMN_NAMES, jobKeySet, parseJobSheet } from "@/lib/job-excel";
import { createServiceClient } from "@/lib/supabase/service";
import { deadlineReviewReasons } from "@/lib/deadline-review";

/*
 * 수집 프로그램이 보낸 공고를 사이트에 넣는다 (/api/jobs/import 가 부른다).
 *
 * 들어오는 모양은 엑셀 '공고' 시트와 같다: 줄마다 { "제목": "...", "기관명": "...", ... }.
 * 엑셀 올리기와 같은 규칙(lib/job-excel.ts)으로 확인하므로 결과도 같다:
 *   - 사이트에 같은 공고가 이미 있으면 건너뜀 (같은 공고가 매일 다시 와도, 다른 곳에서 기관 이름을 붙인 제목으로 와도 한 번만 들어감.
 *     같은 공고인지는 lib/job-excel.ts 의 jobKeys: 제목이 같거나, 기관명이 같고 기관 이름을 뺀 제목이 같음)
 *   - '처리' 칸이 제외·보류면 건너뜀
 *   - 꼭 있어야 하는 칸이 비었거나 마감이 지났으면 넣지 않음 (이유를 돌려줌)
 */

export type ImportSummary = {
  /** 받은 줄 수 */
  received: number;
  /** 새로 들어간 공고 수 */
  created: number;
  /** 새로 들어간 공고 번호 (Threads 에 올릴 때 씀) */
  createdIds: number[];
  /** 일부러 건너뛴 줄 (이미 있음, 제외·보류) */
  skipped: { title: string; reason: string }[];
  /** 넣지 못한 줄 (칸 확인 실패, 저장 실패) */
  failed: { title: string; reason: string }[];
  /**
   * 마감일을 믿기 어려워 '숨김'으로 넣은 공고 (수시 접수 등, lib/deadline-review.ts).
   * 운영자가 원문을 보고 마감일을 고친 뒤 관리자 공고 관리의 '숨김'에서 '다시 올리기'로 공개한다. 받는 문이 운영자 카톡으로 알린다.
   */
  review: { id: number; title: string; reasons: string[] }[];
};

/**
 * 줄 목록(칸 이름 → 값)을 엑셀 시트 모양(첫 줄은 칸 이름)으로 바꾼다. 칸 이름은 처음 나온 순서.
 * 꼭 있어야 하는 칸은 어느 줄에도 없더라도 칸 이름 줄에 넣어 둔다. 그래야 '보류' 줄(마감일 없음)만 온 묶음도
 * 묶음 전체가 거절되지 않고 줄마다 확인된다 (보류면 건너뜀, 아니면 '마감일 …' 이유를 돌려줌).
 */
function toSheet(rows: Record<string, unknown>[]): unknown[][] {
  const header: string[] = [...REQUIRED_COLUMN_NAMES];
  for (const row of rows) {
    for (const name of Object.keys(row)) if (!header.includes(name)) header.push(name);
  }
  return [header, ...rows.map((row) => header.map((name) => row[name] ?? ""))];
}

export async function importJobs(
  rows: Record<string, unknown>[],
  hidden: boolean,
): Promise<ImportSummary | { error: string }> {
  const supabase = createServiceClient();
  if (!supabase) return { error: "SUPABASE_SECRET_KEY 환경 변수가 없어요." };

  const summary: ImportSummary = { received: rows.length, created: 0, createdIds: [], skipped: [], failed: [], review: [] };
  if (rows.length === 0) return summary;
  if (rows.length > MAX_ROWS) return { error: `한 번에 ${MAX_ROWS}줄까지 받을 수 있어요.` };

  const { data: existingRows, error: readError } = await supabase.from("jobs").select("title, job_details(organization)");
  if (readError) {
    console.error("[import] 기존 공고 제목 읽기 실패", readError.code, readError.message);
    return { error: "기존 공고를 읽지 못했어요." };
  }
  const existing = jobKeySet(
    (existingRows as unknown as { title: string; job_details: { organization: string } | null }[]).map((job) => ({
      title: job.title,
      organization: job.job_details?.organization,
    })),
  );

  const parsed = parseJobSheet(toSheet(rows), existing);
  if ("error" in parsed) return { error: parsed.error };

  for (const row of parsed.rows) {
    const title = row.values.title || `(${row.line - 1}번째 줄)`;
    if (row.skipped) {
      summary.skipped.push({ title, reason: row.problem ?? "건너뜀" });
      continue;
    }
    if (row.problem) {
      summary.failed.push({ title, reason: row.problem });
      continue;
    }
    // 마감일을 믿기 어려운 공고(수시 접수 등)는 숨김으로 넣고 운영자가 확인한다.
    const reasons = deadlineReviewReasons(row.values);
    const { data, error } = await supabase.rpc("import_job", { ...toRpcArgs(row.values), p_hidden: hidden || reasons.length > 0 });
    if (error) {
      console.error("[import] 공고 저장 실패", error.code, error.message);
      summary.failed.push({ title, reason: "저장하지 못했어요" });
      continue;
    }
    summary.created += 1;
    if (data) summary.createdIds.push(Number(data));
    if (data && reasons.length > 0) summary.review.push({ id: Number(data), title, reasons });
  }
  return summary;
}

/**
 * 숨김으로 받은 공고 카톡 문구. 카카오 글 메시지는 200자까지라 제목은 줄여 쓰고, 넘치는 공고는 "외 N건"으로 묶는다.
 * 예) [강사잇다] 마감일 확인이 필요한 공고 2건을 숨김으로 받았어요
 *     • 2026학년도 2학기 대덕여자고등학교 푸른꿈… (수시 접수)
 */
export function reviewKakaoText(items: ImportSummary["review"]): string {
  const head = `[강사잇다] 마감일 확인이 필요한 공고 ${items.length}건을 숨김으로 받았어요`;
  const tail = "\n원문에서 마감일을 확인해 고친 뒤 '다시 올리기'를 눌러 주세요.";
  const lines: string[] = [];
  for (const [i, item] of items.entries()) {
    const title = item.title.length > 24 ? `${item.title.slice(0, 24)}…` : item.title;
    const line = `\n• ${title} (${item.reasons.join(", ")})`;
    const rest = items.length - i - 1;
    const more = rest > 0 ? `\n외 ${rest}건` : "";
    if ((head + lines.join("") + line + more + tail).length > 200) {
      lines.push(`\n외 ${items.length - i}건`);
      break;
    }
    lines.push(line);
  }
  return head + lines.join("") + tail;
}
