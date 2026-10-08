import { toRpcArgs } from "@/lib/admin-job-schema";
import { MAX_ROWS, parseJobSheet, titleKey } from "@/lib/job-excel";
import { createServiceClient } from "@/lib/supabase/service";

/*
 * 수집 프로그램이 보낸 공고를 사이트에 넣는다 (/api/jobs/import 가 부른다).
 *
 * 들어오는 모양은 엑셀 '공고' 시트와 같다: 줄마다 { "제목": "...", "기관명": "...", ... }.
 * 엑셀 올리기와 같은 규칙(lib/job-excel.ts)으로 확인하므로 결과도 같다:
 *   - 사이트에 같은 제목이 이미 있으면 건너뜀 (같은 공고가 매일 다시 와도 한 번만 들어감)
 *   - '처리' 칸이 제외·보류면 건너뜀
 *   - 꼭 있어야 하는 칸이 비었거나 마감이 지났으면 넣지 않음 (이유를 돌려줌)
 */

export type ImportSummary = {
  /** 받은 줄 수 */
  received: number;
  /** 새로 들어간 공고 수 */
  created: number;
  /** 일부러 건너뛴 줄 (이미 있음, 제외·보류) */
  skipped: { title: string; reason: string }[];
  /** 넣지 못한 줄 (칸 확인 실패, 저장 실패) */
  failed: { title: string; reason: string }[];
};

/** 줄 목록(칸 이름 → 값)을 엑셀 시트 모양(첫 줄은 칸 이름)으로 바꾼다. 칸 이름은 처음 나온 순서. */
function toSheet(rows: Record<string, unknown>[]): unknown[][] {
  const header: string[] = [];
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

  const summary: ImportSummary = { received: rows.length, created: 0, skipped: [], failed: [] };
  if (rows.length === 0) return summary;
  if (rows.length > MAX_ROWS) return { error: `한 번에 ${MAX_ROWS}줄까지 받을 수 있어요.` };

  const { data: existingRows, error: readError } = await supabase.from("jobs").select("title");
  if (readError) {
    console.error("[import] 기존 공고 제목 읽기 실패", readError.code, readError.message);
    return { error: "기존 공고를 읽지 못했어요." };
  }
  const existing = new Set(existingRows.map((job) => titleKey(job.title)));

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
    const { error } = await supabase.rpc("import_job", { ...toRpcArgs(row.values), p_hidden: hidden });
    if (error) {
      console.error("[import] 공고 저장 실패", error.code, error.message);
      summary.failed.push({ title, reason: "저장하지 못했어요" });
      continue;
    }
    summary.created += 1;
  }
  return summary;
}
