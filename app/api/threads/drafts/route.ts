import { NextResponse } from "next/server";
import { addThreadsDraft, checkDraftKey, cleanDraftBody, THREADS_DRAFT_MAX } from "@/lib/threads";

/*
 * Threads '올릴 글' 받는 문. 매일 아침 홍보 담당(예약 작업)이 쓴 짧은 글을 넣는다.
 * 여기로 들어온 글은 Threads 에 바로 올라가지 않는다. 관리자 화면(/admin/threads)의 '올릴 글'에 '대기'로 쌓이고,
 * 운영자가 [올리기]를 눌러야 올라간다.
 *
 *   POST /api/threads/drafts
 *   Authorization: Bearer <받는 문 열쇠>
 *   { "text": "글 내용 (500자까지)", "date": "2026-11-04" }   ← date 는 선택. 같은 날짜 글은 하나만 받는다.
 *
 * 돌려주는 값: { id, duplicate }  (duplicate=true 면 그 날짜 글이 이미 있어서 새로 넣지 않음)
 * 받는 문 열쇠는 관리자 화면(/admin/threads)의 [받는 문 열쇠 만들기]로 만든다 (데이터베이스에는 해시만 보관).
 * 사이트 환경 변수 THREADS_DRAFT_TOKEN(20자 이상)이 있으면 그 값을 먼저 쓴다. 공고 받는 문의 열쇠와는 다른 값이다.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const key = await checkDraftKey(given);
  if (key === "none") {
    return NextResponse.json({ error: "받는 문이 아직 열리지 않았어요 (관리자 화면에서 받는 문 열쇠를 만들어 주세요)." }, { status: 503 });
  }
  if (key === "wrong") {
    return NextResponse.json({ error: "열쇠가 맞지 않아요." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식이 아니에요." }, { status: 400 });
  }
  const { text, date } = (payload ?? {}) as { text?: unknown; date?: unknown };
  const body = cleanDraftBody(text);
  if (body === null) {
    return NextResponse.json({ error: `text 는 1~${THREADS_DRAFT_MAX}자 글이어야 해요.` }, { status: 400 });
  }
  if (date !== undefined && date !== null && (typeof date !== "string" || !DATE.test(date) || Number.isNaN(Date.parse(date)))) {
    return NextResponse.json({ error: "date 는 2026-11-04 같은 날짜여야 해요." }, { status: 400 });
  }

  try {
    const result = await addThreadsDraft(body, typeof date === "string" ? date : null);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    console.error("[threads] 올릴 글 받기 실패", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "저장하지 못했어요." }, { status: 500 });
  }
}
