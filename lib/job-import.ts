import { toRpcArgs } from "@/lib/admin-job-schema";
import { MAX_ROWS, REQUIRED_COLUMN_NAMES, SAME_JOB_EXISTS, jobKeySet, jobKeys, parseJobSheet } from "@/lib/job-excel";
import { createServiceClient } from "@/lib/supabase/service";
import { deadlineReviewReasons } from "@/lib/deadline-review";

/*
 * 수집 프로그램이 보낸 공고를 사이트에 넣는다 (/api/jobs/import 가 부른다).
 *
 * 들어오는 모양은 엑셀 '공고' 시트와 같다: 줄마다 { "제목": "...", "기관명": "...", ... }.
 * 엑셀 올리기와 같은 규칙(lib/job-excel.ts)으로 확인하므로 결과도 같다:
 *   - 사이트에 같은 공고가 이미 있으면 건너뜀 (같은 공고가 매일 다시 와도, 다른 곳에서 기관 이름을 붙인 제목으로 와도 한 번만 들어감.
 *     같은 공고인지는 lib/job-excel.ts 의 jobKeys: 제목이 같거나, 기관명이 같고 기관 이름을 뺀 제목이 같음)
 *   - 잘린 제목('...강사 모집 …채용...')으로 먼저 들어온 공고는, 원문 주소가 같은 전체 제목 줄이 오면 제목을 고침 (titleFixed)
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
   * 이미 있는 공고인데 지역이 시도만('경남') 있어서, 새로 받은 더 자세한 지역('경남 창녕군')으로 바꾼 공고 수.
   * 수집 프로그램이 나중에 시군을 알아내도 같은 공고는 건너뛰므로, 지역만은 여기서 고친다.
   */
  regionUpdated: number;
  /**
   * 마감일을 믿기 어려워 '숨김'으로 넣은 공고 (수시 접수 등, lib/deadline-review.ts).
   * 운영자가 원문을 보고 마감일을 고친 뒤 관리자 공고 관리의 '숨김'에서 '다시 올리기'로 공개한다. 받는 문이 운영자 카톡으로 알린다.
   */
  review: { id: number; title: string; reasons: string[] }[];
  /**
   * 잘린 제목('...강사 모집 (간호사면허)【경총 … 채용...')으로 먼저 들어온 공고를, 원문 주소가 같은 전체 제목 줄로 고친 수.
   * 제목이 바뀌면 같은 공고로 알아보지 못하므로 여기서 고친다 (cutTitleFixedBy 참고).
   * 전체 제목 공고가 이미 따로 들어와 있으면 잘린 쪽을 숨긴다 (중복이라서).
   */
  titleFixed: number;
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

  const summary: ImportSummary = {
    received: rows.length,
    created: 0,
    createdIds: [],
    skipped: [],
    failed: [],
    review: [],
    regionUpdated: 0,
    titleFixed: 0,
  };
  if (rows.length === 0) return summary;
  if (rows.length > MAX_ROWS) return { error: `한 번에 ${MAX_ROWS}줄까지 받을 수 있어요.` };

  const { data: existingRows, error: readError } = await supabase
    .from("jobs")
    .select("id, title, request_id, hidden_at, job_details(organization, region, source_url)");
  if (readError) {
    console.error("[import] 기존 공고 제목 읽기 실패", readError.code, readError.message);
    return { error: "기존 공고를 읽지 못했어요." };
  }
  type ExistingRow = {
    id: number;
    title: string;
    request_id: number | null;
    hidden_at: string | null;
    job_details: { organization: string; region: string; source_url: string | null } | null;
  };
  const existingJobs = (existingRows as unknown as ExistingRow[]).map((job) => ({
    id: job.id,
    title: job.title,
    organization: job.job_details?.organization,
    region: job.job_details?.region ?? "",
    sourceUrl: job.job_details?.source_url?.trim() ?? "",
    hidden: job.hidden_at !== null,
    fromRequest: job.request_id !== null,
  }));
  // 잘린 제목으로 들어온 공고 (원문 주소 → 공고). 기관이 직접 올린 공고·숨긴 공고는 건드리지 않는다.
  const cutByUrl = new Map<string, (typeof existingJobs)[number]>();
  for (const job of existingJobs) {
    if (job.sourceUrl && !job.fromRequest && !job.hidden && isCutTitle(job.title)) cutByUrl.set(job.sourceUrl, job);
  }
  const titleDone = new Set<number>();
  /** 이 줄이 전체 제목을 가진, 잘린 제목 공고 (없으면 undefined) */
  const cutJobFor = (values: { title: string; sourceUrl: string }) => {
    const job = cutByUrl.get(values.sourceUrl.trim());
    return job && !titleDone.has(job.id) && cutTitleFixedBy(job.title, values.title) ? job : undefined;
  };
  const existing = jobKeySet(existingJobs);
  // 같은 공고 찾기용: 열쇠 → 이미 있는 공고 (지역 고치기에 씀)
  const byKey = new Map<string, (typeof existingJobs)[number]>();
  for (const job of existingJobs) for (const k of jobKeys(job.title, job.organization)) if (!byKey.has(k)) byKey.set(k, job);
  const regionFixed = new Set<number>();

  const parsed = parseJobSheet(toSheet(rows), existing);
  if ("error" in parsed) return { error: parsed.error };

  for (const row of parsed.rows) {
    const title = row.values.title || `(${row.line - 1}번째 줄)`;
    if (row.skipped) {
      summary.skipped.push({ title, reason: row.problem ?? "건너뜀" });
      // 이미 있는 공고: 지역이 '경남'뿐이고 새로 받은 지역이 '경남 창녕군'처럼 더 자세하면 지역만 고친다
      if (row.problem === SAME_JOB_EXISTS) {
        const job = jobKeys(row.values.title, row.values.organization).map((k) => byKey.get(k)).find(Boolean);
        const region = row.values.region.trim();
        if (job && !job.fromRequest && !regionFixed.has(job.id) && betterRegion(job.region, region)) {
          const { error } = await supabase.from("job_details").update({ region }).eq("job_id", job.id);
          if (error) console.error("[import] 지역 고치기 실패", error.code, error.message);
          else {
            regionFixed.add(job.id);
            summary.regionUpdated += 1;
          }
        }
        // 전체 제목 공고가 이미 따로 있으면, 같은 원문의 잘린 제목 공고는 중복이라 숨긴다
        const cut = cutJobFor(row.values);
        if (job && cut && cut.id !== job.id) {
          titleDone.add(cut.id);
          const { error } = await supabase.from("jobs").update({ hidden_at: new Date().toISOString() }).eq("id", cut.id).is("hidden_at", null);
          if (error) console.error("[import] 잘린 제목 중복 숨기기 실패", error.code, error.message);
          else summary.titleFixed += 1;
        }
      }
      continue;
    }
    // 잘린 제목으로 먼저 들어온 공고가 있으면 새로 넣지 않고 그 공고의 제목을 고친다
    const cut = cutJobFor(row.values);
    if (cut) {
      titleDone.add(cut.id);
      if (await fixCutTitle(supabase, cut.id, cut.title, row.values.title)) summary.titleFixed += 1;
      summary.skipped.push({ title, reason: "잘린 제목으로 이미 있던 공고의 제목을 고쳤어요" });
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

/** 앞이나 끝이 '...'·'…'로 잘린 제목 */
const CUT_EDGES = /^\s*(?:\.{2,}|…)|(?:\.{2,}|…)\s*$/g;

/** 수집할 때 잘린 제목인가 ('...강사 모집 (간호사면허)【경총 중장년내일센터 채용...') */
export function isCutTitle(title: string): boolean {
  return new RegExp(CUT_EDGES.source).test(title);
}

/**
 * incoming 이 잘린 제목 cut 의 전체 제목인가: incoming 은 잘리지 않았고, cut 에서 '...'를 뺀 글이 incoming 안에 있다.
 * 예) '...강사 모집 (간호사면허)【경총 중장년내일센터 채용...' → '요양보호사 교육원 강사 모집 (간호사면허)【경총 중장년내일센터 채용대행】'
 */
export function cutTitleFixedBy(cut: string, incoming: string): boolean {
  const core = cut.replace(CUT_EDGES, "").replace(/\s+/g, "");
  return isCutTitle(cut) && !isCutTitle(incoming) && core.length >= 6 && incoming.replace(/\s+/g, "").includes(core);
}

/** 잘린 제목을 전체 제목으로 바꾼다. 상세 내용 첫머리에 잘린 제목이 그대로 들어 있으면 그것도 바꾼다. */
async function fixCutTitle(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  id: number,
  cut: string,
  full: string,
): Promise<boolean> {
  const { error } = await supabase.from("jobs").update({ title: full }).eq("id", id);
  if (error) {
    console.error("[import] 잘린 제목 고치기 실패", error.code, error.message);
    return false;
  }
  const { data } = await supabase.from("job_details").select("description").eq("job_id", id).maybeSingle();
  const description = (data as { description: string } | null)?.description ?? "";
  if (description.includes(cut)) {
    const { error: e } = await supabase.from("job_details").update({ description: description.split(cut).join(full) }).eq("job_id", id);
    if (e) console.error("[import] 잘린 제목(상세 내용) 고치기 실패", e.code, e.message);
  }
  return true;
}

/** 지금 지역이 시도만('경남')이고 새 지역이 그 시도의 시군·구('경남 창녕군')면 true */
export function betterRegion(current: string, incoming: string): boolean {
  const now = current.trim();
  return now !== "" && !now.includes(" ") && incoming.startsWith(`${now} `) && incoming.length > now.length + 1;
}

/**
 * 숨김으로 받은 공고 카톡 문구. 카카오 글 메시지는 200자까지라 제목은 줄여 쓰고, 넘치는 공고는 "외 N건"으로 묶는다.
 * 예) [강사잇다] 마감일 확인이 필요한 공고 2건을 숨김으로 받았어요
 *     • 2026학년도 2학기 대덕여자고등학교 푸른꿈… (수시 접수)
 */
export function reviewKakaoText(items: ImportSummary["review"]): string {
  return kakaoListText(
    `[강사잇다] 마감일 확인이 필요한 공고 ${items.length}건을 숨김으로 받았어요`,
    items.map((item) => `${shortTitle(item.title)} (${item.reasons.join(", ")})`),
    "원문에서 마감일을 확인해 고친 뒤 '다시 올리기'를 눌러 주세요.",
  );
}

/**
 * 원문에서 내려가 숨긴 공고 카톡 문구.
 * 예) [강사잇다] 원문에서 내려간 공고 1건을 숨겼어요
 *     • 11월 전일제 강사 모집 공고 (동포초등학교)
 */
export function hiddenKakaoText(items: HiddenJob[]): string {
  return kakaoListText(
    `[강사잇다] 원문에서 내려간 공고 ${items.length}건을 숨겼어요`,
    items.map((item) => `${shortTitle(item.title)} (${item.organization})`),
    "학교·기관이 원문 공고를 내려 사이트에서도 숨겼어요. 다시 올라오면 '다시 올리기'를 눌러 주세요.",
  );
}

function shortTitle(title: string): string {
  return title.length > 24 ? `${title.slice(0, 24)}…` : title;
}

/** 카카오 글 메시지(200자까지): 머리말 + "• 줄" 목록 + 꼬리말. 넘치는 줄은 "외 N건"으로 묶는다. */
function kakaoListText(head: string, items: string[], tail: string): string {
  const end = `\n${tail}`;
  const lines: string[] = [];
  for (const [i, item] of items.entries()) {
    const line = `\n• ${item}`;
    const rest = items.length - i - 1;
    const more = rest > 0 ? `\n외 ${rest}건` : "";
    if ((head + lines.join("") + line + more + end).length > 200) {
      lines.push(`\n외 ${items.length - i}건`);
      break;
    }
    lines.push(line);
  }
  return head + lines.join("") + end;
}

/** 원문에서 내려가 사이트에서 숨긴 공고 */
export type HiddenJob = { id: number; title: string; organization: string };

/** 수집 프로그램이 한 번에 보내는 '원문에서 내려간 공고' 주소 수 한도 */
export const MAX_REMOVED = 100;

/**
 * 원문에서 내려간 공고 숨기기. 수집 프로그램이 받는 문에 removed(원문 주소 목록)로 보낸다.
 *
 * 학교가 원문 공고를 지우면 원문 링크는 '사이트 오류'가 되는데, 사이트에는 마감일까지 남아 있었다
 * (2026-11-01 동포초 11월 전일제 강사). 경남 수집 프로그램이 목록에서 사라지고 상세도 열리지 않는 공고를 찾아
 * removed.json 으로 알리면, 울산 브리핑이 그 원문 주소를 여기로 보낸다.
 *
 * 원문 링크가 같고, 아직 숨기지 않았고, 마감 전이고, 기관이 강사잇다에 직접 올린 공고가 아닌 것만 숨긴다
 * (지우지 않는다. 관리자 공고 관리의 '숨김'에서 '다시 올리기'로 되돌릴 수 있다). 이미 숨긴 공고는 그대로라 여러 번 받아도 된다.
 */
export async function hideRemovedJobs(urls: string[], today: string): Promise<HiddenJob[] | { error: string }> {
  const wanted = [...new Set(urls.map((u) => u.trim()).filter((u) => /^https:\/\//i.test(u)))].slice(0, MAX_REMOVED);
  if (wanted.length === 0) return [];
  const supabase = createServiceClient();
  if (!supabase) return { error: "SUPABASE_SECRET_KEY 환경 변수가 없어요." };

  const { data, error } = await supabase
    .from("job_details")
    .select("job_id, organization, deadline, source_url, jobs!inner(title, hidden_at, request_id)")
    .in("source_url", wanted);
  if (error) {
    console.error("[import] 내려간 공고 찾기 실패", error.code, error.message);
    return { error: "내려간 공고를 찾지 못했어요." };
  }
  type Row = { job_id: number; organization: string; deadline: string; jobs: { title: string; hidden_at: string | null; request_id: number | null } | null };
  const targets = (data as unknown as Row[]).filter(
    (r) => r.jobs && r.jobs.hidden_at === null && r.jobs.request_id === null && r.deadline >= today,
  );
  if (targets.length === 0) return [];

  const { data: updated, error: updateError } = await supabase
    .from("jobs")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", targets.map((r) => r.job_id))
    .is("hidden_at", null)
    .select("id");
  if (updateError) {
    console.error("[import] 내려간 공고 숨기기 실패", updateError.code, updateError.message);
    return { error: "내려간 공고를 숨기지 못했어요." };
  }
  const done = new Set((updated as { id: number }[]).map((r) => r.id));
  return targets
    .filter((r) => done.has(r.job_id))
    .map((r) => ({ id: r.job_id, title: r.jobs?.title ?? "", organization: r.organization }));
}
