import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { MAX_ROWS } from "@/lib/job-excel";
import { importJobs } from "@/lib/job-import";

/*
 * 수집 프로그램이 공고를 넣는 '받는 문'. 매일 새벽 GitHub Actions(울산 저장소의 오늘의 브리핑)가 부른다.
 *
 *   POST /api/jobs/import
 *   Authorization: Bearer <JOB_IMPORT_TOKEN>
 *   { "rows": [ { "제목": "...", "기관명": "...", "지역": "...", "마감일": "2026-10-15", ... } ] }
 *
 * 비밀 열쇠(JOB_IMPORT_TOKEN)가 맞을 때만 받는다. 열쇠는 Vercel 환경 변수와 수집 저장소의 Secrets 두 곳에 같은 값을 둔다.
 * JOB_IMPORT_REVIEW=1 이면 '숨김' 상태로 넣어 관리자가 확인한 뒤 공개한다. 없으면 바로 공개.
 * 돌려주는 값: { received, created, skipped: [...], failed: [...] } (lib/job-import.ts)
 */

const MIN_TOKEN_LENGTH = 20;

/** 글자 길이가 달라도 시간 차이로 열쇠를 알아낼 수 없게 비교한다. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const token = process.env.JOB_IMPORT_TOKEN;
  if (!token || token.length < MIN_TOKEN_LENGTH) {
    return NextResponse.json({ error: "받는 문이 아직 열리지 않았어요 (JOB_IMPORT_TOKEN 없음)." }, { status: 503 });
  }
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!sameSecret(given, token)) {
    return NextResponse.json({ error: "열쇠가 맞지 않아요." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식이 아니에요." }, { status: 400 });
  }
  const rows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows) || rows.length > MAX_ROWS || !rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
    return NextResponse.json({ error: `rows 는 공고 줄 목록(최대 ${MAX_ROWS}개)이어야 해요.` }, { status: 400 });
  }

  const result = await importJobs(rows as Record<string, unknown>[], process.env.JOB_IMPORT_REVIEW === "1");
  if ("error" in result) return NextResponse.json(result, { status: 500 });

  // 새 공고가 홈·공고 목록·관리자 목록에 바로 보이게
  if (result.created > 0) revalidatePath("/", "layout");
  return NextResponse.json(result);
}
