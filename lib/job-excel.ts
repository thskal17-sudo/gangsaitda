import type { JobInput } from "@/lib/admin-job-schema";
import { newJobSchema } from "@/lib/admin-job-schema";

/*
 * 엑셀로 공고 여러 개 올리기 — 엑셀 내용을 공고 입력값으로 바꾸고 줄마다 확인한다.
 * 화면(미리보기)과 서버(최종 확인)가 같은 규칙을 쓴다. 칸 규칙은 공고 등록 화면과 같다.
 *
 * - 첫 줄(칸 이름)을 보고 칸을 찾는다. 칸 순서는 상관없고, 모르는 칸(메모 등)은 무시한다.
 * - '처리' 칸이 있으면 '제외…', '보류…'로 적힌 줄은 건너뛴다 (확인용 엑셀을 그대로 올릴 때).
 */

/** 엑셀 칸 이름 → 공고 입력 칸. 같은 뜻의 여러 이름을 받는다 (띄어쓰기 무시). */
const COLUMN_NAMES: Record<keyof JobInput, string[]> = {
  title: ["제목", "공고 제목"],
  organization: ["기관명", "기관"],
  region: ["지역"],
  deadline: ["마감일"],
  schedule: ["수업 일정", "일정"],
  description: ["상세 내용", "상세 내용(요약)"],
  target: ["수업 대상", "대상"],
  headcount: ["모집 인원", "인원"],
  qualifications: ["지원 자격", "자격"],
  documents: ["제출 서류"],
  sourceUrl: ["원문 링크", "원문 공고 주소", "원문 주소"],
  applyUrl: ["지원서 링크"],
  applyEmail: ["지원 이메일", "담당자 이메일", "이메일"],
};

/** 꼭 있어야 하는 칸 (양식의 앞 여섯 칸) */
const REQUIRED_COLUMNS: (keyof JobInput)[] = ["title", "organization", "region", "deadline", "schedule", "description"];

/** 한 번에 올릴 수 있는 줄 수 */
export const MAX_ROWS = 200;

export type ExcelRow = {
  /** 엑셀에서 몇 번째 줄인지 (칸 이름 줄이 1) */
  line: number;
  values: JobInput;
  /** 올릴 수 없는 이유. 없으면 올릴 수 있는 줄 */
  problem?: string;
  /** 문제가 아니라 일부러 건너뛰는 줄 ('처리' 칸이 제외·보류) */
  skipped?: boolean;
};

export type ExcelParseResult = { rows: ExcelRow[] } | { error: string };

const squash = (s: string) => s.replace(/\s+/g, "");

/** 칸 하나를 글자로. 엑셀 날짜 칸은 "2026-10-15" 로 바꾼다. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** "2026.10.5.", "2026/10/05", "2026-10-5" → "2026-10-05". 알아볼 수 없으면 그대로 둔다. */
export function normalizeDate(text: string): string {
  const m = text.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[.일]?$/);
  if (!m) return text;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** 제목 비교용: 띄어쓰기 차이는 같은 것으로 본다. */
export function titleKey(title: string): string {
  return squash(title).toLowerCase();
}

/**
 * 엑셀 한 장(줄 목록)을 공고 줄로 바꾸고 확인한다.
 * existingTitles: 이미 사이트에 있는 공고 제목들 (titleKey 로 바꾼 것). 같은 제목은 건너뛴다.
 */
export function parseJobSheet(sheet: unknown[][], existingTitles: Set<string>): ExcelParseResult {
  // 칸 이름 줄: 맨 위 5줄 중 '제목' 칸이 있는 첫 줄
  const headerIndex = sheet.slice(0, 5).findIndex((row) => row.some((c) => squash(cellText(c)) === "제목"));
  if (headerIndex === -1) return { error: "첫 줄에서 '제목' 칸을 찾지 못했어요. 양식의 칸 이름을 그대로 써 주세요." };

  const header = sheet[headerIndex].map((c) => squash(cellText(c)));
  const columnOf = {} as Record<keyof JobInput, number>;
  for (const key of Object.keys(COLUMN_NAMES) as (keyof JobInput)[]) {
    columnOf[key] = header.findIndex((h) => COLUMN_NAMES[key].some((name) => squash(name) === h));
  }
  const missing = REQUIRED_COLUMNS.filter((key) => columnOf[key] === -1).map((key) => COLUMN_NAMES[key][0]);
  if (missing.length > 0) return { error: `꼭 있어야 하는 칸이 없어요: ${missing.join(", ")}` };
  const statusColumn = header.findIndex((h) => h === "처리");

  const rows: ExcelRow[] = [];
  const seen = new Set<string>();

  sheet.slice(headerIndex + 1).forEach((cells, i) => {
    const line = headerIndex + 2 + i;
    // 완전히 빈 줄은 없는 것으로 본다.
    if (cells.every((c) => cellText(c) === "")) return;

    const values = {} as JobInput;
    for (const key of Object.keys(COLUMN_NAMES) as (keyof JobInput)[]) {
      values[key] = columnOf[key] === -1 ? "" : cellText(cells[columnOf[key]]);
    }
    values.deadline = normalizeDate(values.deadline);

    const status = statusColumn === -1 ? "" : cellText(cells[statusColumn]);
    if (/^(제외|보류)/.test(status)) {
      rows.push({ line, values, skipped: true, problem: `처리 칸이 '${status}'` });
      return;
    }

    const key = titleKey(values.title);
    if (key && existingTitles.has(key)) {
      rows.push({ line, values, skipped: true, problem: "같은 제목의 공고가 이미 있어요" });
      return;
    }
    if (key && seen.has(key)) {
      rows.push({ line, values, skipped: true, problem: "엑셀 안에 같은 제목이 또 있어요" });
      return;
    }
    if (key) seen.add(key);

    const parsed = newJobSchema.safeParse(values);
    rows.push(parsed.success ? { line, values: parsed.data } : { line, values, problem: parsed.error.issues[0].message });
  });

  if (rows.length === 0) return { error: "올릴 줄이 없어요. 칸 이름 아래에 공고를 적어 주세요." };
  if (rows.length > MAX_ROWS) return { error: `한 번에 ${MAX_ROWS}줄까지 올릴 수 있어요. 파일을 나눠 주세요.` };
  return { rows };
}
