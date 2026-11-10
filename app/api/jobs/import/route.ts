import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, after } from "next/server";
import { MAX_ROWS } from "@/lib/job-excel";
import { MAX_REMOVED, hiddenKakaoText, hideRemovedJobs, importJobs, reviewKakaoText, supersededKakaoText, duplicateKakaoText } from "@/lib/job-import";
import { todayInSeoul } from "@/lib/date";
import { sendKakaoToMe } from "@/lib/kakao";
import { SITE_URL } from "@/lib/site";
import { shareNewJobsOnThreads } from "@/lib/threads";

/*
 * 수집 프로그램이 공고를 넣는 '받는 문'. 매일 새벽 GitHub Actions(울산 저장소의 오늘의 브리핑)가 부른다.
 *
 *   POST /api/jobs/import
 *   Authorization: Bearer <JOB_IMPORT_TOKEN>
 *   { "rows": [ { "제목": "...", "기관명": "...", "지역": "...", "마감일": "2026-10-15", ... } ] }
 *
 * 비밀 열쇠(JOB_IMPORT_TOKEN)가 맞을 때만 받는다. 열쇠는 Vercel 환경 변수와 수집 저장소의 Secrets 두 곳에 같은 값을 둔다.
 * JOB_IMPORT_REVIEW=1 이면 '숨김' 상태로 넣어 관리자가 확인한 뒤 공개한다. 없으면 바로 공개.
 * 돌려주는 값: { received, created, createdIds, skipped: [...], failed: [...], review: [...] } (lib/job-import.ts)
 * 바로 공개한 새 공고는 응답을 보낸 뒤 Threads 에도 한 글로 묶어 올린다 (lib/threads.ts, 연결했을 때만).
 * 마감일을 믿기 어려워 숨김으로 넣은 공고(review, 수시 접수 등)는 Threads 에 올리지 않고 운영자 카톡으로 알린다.
 *
 * "removed": [원문 주소, ...] (선택, 최대 100개) — 원문에서 내려간 공고 (학교가 지워 원문이 '사이트 오류'가 된 것).
 * 원문 링크가 같은 공고를 숨기고(lib/job-import.ts 의 hideRemovedJobs) 돌려주는 값의 hidden 에 담아, 운영자 카톡으로 알린다.
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

  const removed = (body as { removed?: unknown }).removed ?? [];
  if (!Array.isArray(removed) || removed.length > MAX_REMOVED || !removed.every((u) => typeof u === "string")) {
    return NextResponse.json({ error: `removed 는 원문 주소 목록(최대 ${MAX_REMOVED}개)이어야 해요.` }, { status: 400 });
  }

  const review = process.env.JOB_IMPORT_REVIEW === "1";
  const result = await importJobs(rows as Record<string, unknown>[], review);
  if ("error" in result) return NextResponse.json(result, { status: 500 });

  // 원문에서 내려간 공고 숨기기. 실패해도 새 공고 등록 결과는 그대로 돌려준다
  const hidden = await hideRemovedJobs(removed as string[], todayInSeoul());
  const hiddenJobs = "error" in hidden ? [] : hidden;
  if (hiddenJobs.length > 0) {
    revalidatePath("/", "layout");
    after(() => sendKakaoToMe(hiddenKakaoText(hiddenJobs), `${SITE_URL}/admin/jobs?filter=hidden`, "숨긴 공고 보기"));
  }

  // 새 공고가 홈·공고 목록·관리자 목록에 바로 보이게
  if (result.created > 0) revalidatePath("/", "layout");
  const held = new Set(result.review.map((r) => r.id));
  const shared = result.createdIds.filter((id) => !held.has(id));
  if (!review && shared.length > 0) after(() => shareNewJobsOnThreads(shared));
  if (result.review.length > 0) after(() => sendKakaoToMe(reviewKakaoText(result.review), `${SITE_URL}/admin/jobs?filter=hidden`, "숨긴 공고 보기"));
  // 같은 자리의 2차·재공고가 있어 지난 차수 공고를 숨겼으면 화면을 새로 그리고 운영자에게 알린다
  if (result.duplicatesHidden.length > 0) {
    revalidatePath("/", "layout");
    after(() => sendKakaoToMe(duplicateKakaoText(result.duplicatesHidden), `${SITE_URL}/admin/jobs?filter=hidden`, "숨긴 공고 보기"));
  }
  if (result.superseded.length > 0) {
    revalidatePath("/", "layout");
    after(() => sendKakaoToMe(supersededKakaoText(result.superseded), `${SITE_URL}/admin/jobs?filter=hidden`, "숨긴 공고 보기"));
  }
  return NextResponse.json({ ...result, hidden: hiddenJobs, ...("error" in hidden ? { hiddenError: hidden.error } : {}) });
}

