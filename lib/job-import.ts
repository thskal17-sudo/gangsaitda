import { toRpcArgs } from "@/lib/admin-job-schema";
import { MAX_ROWS, REQUIRED_COLUMN_NAMES, SAME_JOB_EXISTS, jobKeySet, jobKeys, parseJobSheet } from "@/lib/job-excel";
import { readAllRows } from "@/lib/supabase/read-all";
import { createServiceClient } from "@/lib/supabase/service";
import { deadlineReviewReasons } from "@/lib/deadline-review";
import { NO_BODY, tidyCollected } from "@/lib/readable-text";

/*
 * 수집 프로그램이 보낸 공고를 사이트에 넣는다 (/api/jobs/import 가 부른다).
 *
 * 들어오는 모양은 엑셀 '공고' 시트와 같다: 줄마다 { "제목": "...", "기관명": "...", ... }.
 * 엑셀 올리기와 같은 규칙(lib/job-excel.ts)으로 확인하므로 결과도 같다:
 *   - 사이트에 같은 공고가 이미 있으면 건너뜀 (같은 공고가 매일 다시 와도, 다른 곳에서 기관 이름을 붙인 제목으로 와도 한 번만 들어감.
 *     같은 공고인지는 lib/job-excel.ts 의 jobKeys: 제목이 같거나, 기관명이 같고 기관 이름을 뺀 제목이 같음)
 *   - 잘린 제목('...강사 모집 …채용...')으로 먼저 들어온 공고는, 원문 주소가 같은 전체 제목 줄이 오면 제목을 고침 (titleFixed)
 *   - 상세 내용은 수집 공고 규칙대로 정리해 넣음 (표에서 풀린 글 빼기, 800자까지, 끝에 같은 안내 한 줄. lib/readable-text.ts 의 tidyCollected)
 *   - 본문 없이 먼저 들어온 공고는 같은 공고 줄의 본문으로 채움 (bodyFilled)
 *   - 같은 자리의 다음 차수 공고(2차·재공고)가 오면 지난 차수 공고를 숨김 (superseded). 지난 차수 줄은 새로 넣지 않음
 *   - 같은 기관·마감일에 제목만 조금 다른 같은 공고는 새로 넣지 않고, 이미 둘이 보이면 나중 것을 숨김 (duplicatesHidden)
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
  /** 원문 링크 없이 먼저 들어온 공고에, 같은 공고 줄의 원문 링크를 채운 수 */
  sourceUrlFilled: number;
  /** 본문 없이 먼저 들어온 공고에, 같은 공고 줄의 본문을 넣은 수 (fillBodies) */
  bodyFilled: number;
  /** 같은 자리의 다음 차수 공고(2차·재공고)가 있어 숨긴 지난 차수 공고 (hideSupersededRounds). 받는 문이 카톡으로 알린다 */
  superseded: HiddenJob[];
  /** 같은 기관·마감일에 제목만 조금 다른 같은 공고가 둘 보여 숨긴 쪽 (hideNearDuplicates). 받는 문이 카톡으로 알린다 */
  duplicatesHidden: HiddenJob[];
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
    sourceUrlFilled: 0,
    bodyFilled: 0,
    superseded: [],
    duplicatesHidden: [],
  };
  if (rows.length === 0) return summary;
  if (rows.length > MAX_ROWS) return { error: `한 번에 ${MAX_ROWS}줄까지 받을 수 있어요.` };

  // 1000줄씩 나눠 끝까지 읽는다. 한 번에 읽으면 1000건 뒤 공고가 빠져 매번 '새 공고'로 다시 들어간다 (lib/supabase/read-all.ts)
  const { data: existingRows, error: readError } = await readAllRows((from, to) =>
    supabase
      .from("jobs")
      .select("id, title, request_id, hidden_at, job_details(organization, region, source_url, deadline)")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (readError) {
    console.error("[import] 기존 공고 제목 읽기 실패", readError.code, readError.message);
    return { error: "기존 공고를 읽지 못했어요." };
  }
  type ExistingRow = {
    id: number;
    title: string;
    request_id: number | null;
    hidden_at: string | null;
    job_details: { organization: string; region: string; source_url: string | null; deadline: string | null } | null;
  };
  const existingJobs = (existingRows as unknown as ExistingRow[]).map((job) => ({
    id: job.id,
    title: job.title,
    organization: job.job_details?.organization,
    region: job.job_details?.region ?? "",
    sourceUrl: job.job_details?.source_url?.trim() ?? "",
    deadline: job.job_details?.deadline ?? "",
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
  const urlFilled = new Set<number>();
  const bodyWanted = new Map<number, { body: string; title: string }>();
  const createdJobs: SeriesJob[] = [];

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
        // 원문 링크 없이 먼저 들어온 공고: 새로 받은 줄에 원문 링크가 있으면 채운다
        // (경남 시군 새올의 http:// 주소를 수집 프로그램이 빼고 보낸 적이 있다. 2026-11-04 창녕·거제·하동)
        const sourceUrl = row.values.sourceUrl.trim();
        if (job && !job.fromRequest && !job.sourceUrl && !urlFilled.has(job.id) && /^https?:\/\/\S+$/i.test(sourceUrl)) {
          const { error } = await supabase.from("job_details").update({ source_url: sourceUrl }).eq("job_id", job.id).is("source_url", null);
          if (error) console.error("[import] 원문 링크 채우기 실패", error.code, error.message);
          else {
            urlFilled.add(job.id);
            summary.sourceUrlFilled += 1;
          }
        }
        // 본문 없이 먼저 들어온 공고: 새로 받은 줄에 본문이 있으면 나중에 한꺼번에 채운다 (아래 fillBodies)
        if (job && !job.fromRequest && !bodyWanted.has(job.id)) {
          const body = tidyCollected(row.values.description, job.title);
          if (body !== NO_BODY) bodyWanted.set(job.id, { body, title: job.title });
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
    // 같은 자리의 더 나중 차수 공고가 이미 있으면 지난 차수 줄은 넣지 않는다 ('… 공고(1차)' 뒤에 '… 공고(2차)'가 있음)
    // 같은 공고를 다른 게시판에 제목만 조금 다르게 올린 것 ('…및 학년말 방학 중…' / '…및 방학 중…')은 넣지 않는다
    if (existingJobs.some((job) => !job.fromRequest && nearDuplicate(job, row.values))) {
      summary.skipped.push({ title, reason: "같은 공고가 이미 있어요 (같은 기관·마감일, 제목이 조금 다름)" });
      continue;
    }
    if (existingJobs.some((job) => !job.fromRequest && laterRoundOf(job, row.values))) {
      summary.skipped.push({ title, reason: "같은 자리의 다음 차수 공고가 이미 있어요" });
      continue;
    }
    // 마감일을 믿기 어려운 공고(수시 접수 등)는 숨김으로 넣고 운영자가 확인한다.
    const reasons = deadlineReviewReasons(row.values);
    // 상세 내용은 '수집 공고 상세 내용 규칙'대로 정리해 넣는다 (표에서 풀린 글 빼기, 800자까지. lib/readable-text.ts)
    const values = { ...row.values, description: tidyCollected(row.values.description, row.values.title) };
    const { data, error } = await supabase.rpc("import_job", { ...toRpcArgs(values), p_hidden: hidden || reasons.length > 0 });
    if (error) {
      console.error("[import] 공고 저장 실패", error.code, error.message);
      summary.failed.push({ title, reason: "저장하지 못했어요" });
      continue;
    }
    summary.created += 1;
    if (data) {
      summary.createdIds.push(Number(data));
      createdJobs.push({
        id: Number(data),
        title: values.title,
        organization: values.organization,
        deadline: values.deadline,
        hidden: hidden || reasons.length > 0,
      });
    }
    if (data && reasons.length > 0) summary.review.push({ id: Number(data), title, reasons });
  }
  summary.bodyFilled = await fillBodies(supabase, bodyWanted);
  const series = [...existingJobs.filter((job) => !job.fromRequest), ...createdJobs];
  summary.superseded = await hideSupersededRounds(supabase, series);
  summary.duplicatesHidden = await hideNearDuplicates(supabase, series);
  return summary;
}

/*
 * 제목만 조금 다른 같은 공고 (2026-11-10)
 *
 * 학교는 같은 공고를 교육청 게시판과 교육지원청 게시판에 함께 올리면서 제목을 조금 다르게 쓴다
 * ('송정유치원 교육과정 겨울방학 및 학년말 방학 중 …' / '… 겨울방학 및 방학 중 …'). 제목이 똑같지 않아 같은 공고로 보지 못했다.
 * 기관명·마감일·차수가 같고, 연도·기호를 뺀 제목 한쪽이 다른 쪽에서 글자 몇 개를 뺀 것(빠진 글자가 4분의 1 이하)이면 같은 공고로 본다.
 * '방과후 영어 강사'와 '방과후 수학 강사'처럼 다른 낱말로 바뀐 제목은 같은 공고로 보지 않는다.
 */

/** short 의 글자가 long 안에 차례대로 모두 있는가 (long 에서 글자 몇 개를 빼면 short 가 되는가) */
function isSubsequence(short: string, long: string): boolean {
  let i = 0;
  for (const ch of long) if (i < short.length && ch === short[i]) i += 1;
  return i === short.length;
}

type DuplicateCandidate = { title: string; organization?: string; deadline?: string };

/** a 와 b 가 제목만 조금 다른 같은 공고인가 */
export function nearDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  const org = (a.organization ?? "").replace(/\s+/g, "");
  if (!org || org !== (b.organization ?? "").replace(/\s+/g, "")) return false;
  if (!a.deadline || a.deadline !== b.deadline || roundOf(a.title) !== roundOf(b.title)) return false;
  const ta = seriesTitle(a.title, org);
  const tb = seriesTitle(b.title, org);
  if (ta === tb) return true;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.length >= 12 && short.length * 4 >= long.length * 3 && isSubsequence(short, long);
}

/** 제목만 조금 다른 같은 공고가 둘 이상 보이면 나중에 올라간 쪽(번호가 큰 쪽)을 숨긴다. 숨긴 공고 목록. */
async function hideNearDuplicates(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  jobs: SeriesJob[],
): Promise<HiddenJob[]> {
  const visible = jobs.filter((job) => !job.hidden).sort((x, y) => x.id - y.id);
  const dup = new Map<number, SeriesJob>();
  visible.forEach((job, i) => {
    if (dup.has(job.id)) return;
    for (const later of visible.slice(i + 1)) if (!dup.has(later.id) && nearDuplicate(job, later)) dup.set(later.id, later);
  });
  if (dup.size === 0) return [];
  const { data, error } = await supabase
    .from("jobs")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", [...dup.keys()])
    .is("hidden_at", null)
    .select("id");
  if (error) {
    console.error("[import] 같은 공고(제목 조금 다름) 숨기기 실패", error.code, error.message);
    return [];
  }
  return (data as { id: number }[]).map((r) => {
    const job = dup.get(r.id);
    return { id: r.id, title: job?.title ?? "", organization: job?.organization ?? "" };
  });
}

/**
 * 같은 공고가 두 번 올라가 하나를 숨긴 카톡 문구.
 * 예) [강사잇다] 같은 공고가 두 번 올라가 1건을 숨겼어요
 *     • 송정유치원 교육과정 겨울방학 및 방학… (송정유치원)
 */
export function duplicateKakaoText(items: HiddenJob[]): string {
  return kakaoListText(
    `[강사잇다] 같은 공고가 두 번 올라가 ${items.length}건을 숨겼어요`,
    items.map((item) => `${shortTitle(item.title)} (${item.organization})`),
    "같은 기관·마감일에 제목만 조금 다른 공고를 하나만 남겼어요. 잘못 숨겼으면 '다시 올리기'를 눌러 주세요.",
  );
}

/*
 * 지난 차수 공고 숨기기 (2026-11-06)
 *
 * 학교는 지원자가 없으면 같은 자리를 '(2차)', '재공고'로 다시 올린다. 수집 프로그램은 이것을 다른 공고로 보내서
 * 사이트에 1차와 2차가 함께 남았다 ('[형곡초등학교] 계약제교원(전일제강사_1,2학년 담임, 전담) 채용 공고(1차)'와 '(2차)').
 * 기관명이 같고, 연도·차수 표시를 뺀 제목이 거의 같으면(글자 짝 겹침 0.85 이상) 같은 자리로 보고, 차수가 낮은 쪽을 숨긴다.
 * '(전일제강사_체육)'과 '(전일제강사_체육 전담)'은 같은 자리(0.88), '1,2학년 담임'과 '체육'은 다른 자리(0.67)로 본다.
 */

/** 차수 표시: '(2차)', '2차', '제2차', '재공고', '재재공고', '(재)' ('1차시'는 아님) */
const ROUND_MARK = /\(?\s*(?:제\s*)?(\d{1,2})\s*차(?!시)\s*\)?|\(?\s*(재+)\s*공고\s*\)?|\(\s*재\s*\)/g;
/** 같은 자리로 볼 제목 닮음 정도 */
const SAME_SERIES = 0.85;

type SeriesJob = { id: number; title: string; organization?: string; deadline?: string; hidden: boolean };

/** 차수: '(2차)' → 2, '재공고' → 2, '재재공고' → 3, 표시 없으면 1 */
export function roundOf(title: string): number {
  let round = 1;
  for (const m of title.matchAll(ROUND_MARK)) {
    if (m[1]) round = Math.max(round, Number(m[1]));
    else if (m[2]) round = Math.max(round, m[2].length + 1);
    else round = Math.max(round, 2);
  }
  return round;
}

/** 차수·연도·기관 이름·기호를 뺀 제목 (같은 자리인지 비교용) */
function seriesTitle(title: string, organization = ""): string {
  const org = organization.replace(/\s+/g, "");
  return title
    .replace(ROUND_MARK, " ")
    .replace(/20\d\d\s*(?:학년도|년도|년)?/g, " ")
    .replace(/\s+/g, "")
    .split(org || "\u0000")
    .join("")
    .replace(/[^0-9A-Za-z가-힣]/g, "");
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i += 1) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
  return out;
}

/** 글자 짝(두 글자씩) 겹침 정도 0~1 */
function likeness(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let common = 0;
  for (const [k, n] of A) common += Math.min(n, B.get(k) ?? 0);
  return (2 * common) / (a.length - 1 + (b.length - 1));
}

/** a 와 b 가 같은 자리 공고인가 (기관명 같고 차수 뺀 제목이 거의 같음) */
export function sameSeries(a: { title: string; organization?: string }, b: { title: string; organization?: string }): boolean {
  const orgA = (a.organization ?? "").replace(/\s+/g, "");
  if (!orgA || orgA !== (b.organization ?? "").replace(/\s+/g, "")) return false;
  const ta = seriesTitle(a.title, orgA);
  const tb = seriesTitle(b.title, orgA);
  return Math.min(ta.length, tb.length) >= 8 && likeness(ta, tb) >= SAME_SERIES;
}

/** later 가 earlier 와 같은 자리의 더 나중 차수 공고인가 */
function laterRoundOf(later: { title: string; organization?: string }, earlier: { title: string; organization?: string }): boolean {
  return roundOf(later.title) > roundOf(earlier.title) && sameSeries(later, earlier);
}

/** 같은 자리의 더 나중 차수 공고가 있는, 아직 보이는 공고를 숨긴다. 숨긴 공고 목록. */
async function hideSupersededRounds(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  jobs: SeriesJob[],
): Promise<HiddenJob[]> {
  const byOrg = new Map<string, SeriesJob[]>();
  for (const job of jobs) {
    const org = (job.organization ?? "").replace(/\s+/g, "");
    if (org) byOrg.set(org, [...(byOrg.get(org) ?? []), job]);
  }
  const stale = new Map<number, SeriesJob>();
  for (const group of byOrg.values()) {
    if (group.length < 2) continue;
    for (const older of group) {
      if (!older.hidden && group.some((newer) => newer.id !== older.id && laterRoundOf(newer, older))) stale.set(older.id, older);
    }
  }
  if (stale.size === 0) return [];
  const { data, error } = await supabase
    .from("jobs")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", [...stale.keys()])
    .is("hidden_at", null)
    .select("id");
  if (error) {
    console.error("[import] 지난 차수 공고 숨기기 실패", error.code, error.message);
    return [];
  }
  return (data as { id: number }[]).map((r) => {
    const job = stale.get(r.id);
    return { id: r.id, title: job?.title ?? "", organization: job?.organization ?? "" };
  });
}

/**
 * 지난 차수 공고를 숨긴 카톡 문구.
 * 예) [강사잇다] 다음 차수 공고가 올라와 지난 공고 1건을 숨겼어요
 *     • [형곡초등학교] 계약제교원(전일제강사_1,… (형곡초등학교)
 */
export function supersededKakaoText(items: HiddenJob[]): string {
  return kakaoListText(
    `[강사잇다] 다음 차수 공고가 올라와 지난 공고 ${items.length}건을 숨겼어요`,
    items.map((item) => `${shortTitle(item.title)} (${item.organization})`),
    "같은 자리의 2차·재공고가 있어 지난 차수 공고를 숨겼어요. 잘못 숨겼으면 '다시 올리기'를 눌러 주세요.",
  );
}

/**
 * 본문 없이 먼저 들어온 공고(상세 내용이 예전 안내 글뿐이라 화면에 NO_BODY 한 줄만 보이는 공고)에, 같은 공고 줄로 받은 본문을 넣는다.
 * 상세 내용 통일(2026-11-05) 전에 부산·경북·울산 수집 프로그램은 본문 대신 제목·분야·접수 마감·원문 주소만 보냈다.
 * 본문이 이미 있는 공고는 건드리지 않는다 (운영자가 고친 글을 덮어쓰지 않게). 넣은 공고 수.
 */
async function fillBodies(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  wanted: Map<number, { body: string; title: string }>,
): Promise<number> {
  if (wanted.size === 0) return 0;
  const ids = [...wanted.keys()];
  const stubs: number[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from("job_details").select("job_id, description").in("job_id", ids.slice(i, i + 200));
    if (error) {
      console.error("[import] 본문 채우기용 상세 내용 읽기 실패", error.code, error.message);
      return 0;
    }
    for (const r of data as { job_id: number; description: string }[]) {
      if (tidyCollected(r.description, wanted.get(r.job_id)?.title) === NO_BODY) stubs.push(r.job_id);
    }
  }
  let filled = 0;
  for (const id of stubs) {
    const { error } = await supabase.from("job_details").update({ description: wanted.get(id)?.body }).eq("job_id", id);
    if (error) console.error("[import] 본문 채우기 실패", error.code, error.message);
    else filled += 1;
  }
  return filled;
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
  const wanted = [...new Set(urls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)))].slice(0, MAX_REMOVED);
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
