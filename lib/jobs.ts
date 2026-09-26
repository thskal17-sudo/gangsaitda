import { createClient } from "@/lib/supabase/server";

/*
 * 공고 데이터. Supabase 의 표 두 개에서 읽는다 (supabase/jobs.sql).
 * - jobs: 제목. 비회원은 표를 직접 못 읽고, 데이터베이스 함수로 '번호·제목'만 받는다.
 * - job_details: 나머지 전부 (기관·지역·마감일·수업 일정·지원 방법 …). 회원만 읽을 수 있다.
 * 비회원 화면에서 가리는 게 아니라, 데이터베이스가 비회원에게 아예 내주지 않는다.
 */

/** 누구나 볼 수 있는 것: 번호와 제목 */
export type JobTitle = {
  id: string;
  title: string;
};

/** 공고 요약. 회원에게 보여주는 목록 카드와 상세 화면 윗부분에 쓴다. */
export type Job = JobTitle & {
  organization: string;
  region: string;
  /** 마감일 (한국 날짜). 예: "2026-09-25" */
  deadline: string;
};

/**
 * 공고 상세. 회원에게만 보여준다. 비어 있는 항목은 화면에 나오지 않는다.
 * 수업 일정처럼 공고마다 형식이 다른 항목은 운영자가 글로 자유롭게 적는다.
 */
export type JobDetail = Job & {
  /** 원문 공고 주소 */
  sourceUrl?: string;
  /** 수업 일정. 예: "매주 화·목 14:00~15:30 (10주)" */
  schedule: string;
  /** 수업 대상. 예: "초등 3~4학년 약 20명" */
  target?: string;
  /** 모집 인원 */
  headcount?: number;
  /** 상세 내용. 줄바꿈은 그대로 보여준다. */
  description: string;
  /** 지원 자격. 한 줄에 하나씩 적으면 목록으로 보여준다. */
  qualifications?: string;
  /** 제출 서류. 예: "이력서, 자격증 사본" */
  documents?: string;
  /** 지원 방법 — 둘 중 하나 이상 */
  applyUrl?: string;
  applyEmail?: string;
};

/** 데이터베이스에서 오는 한 줄의 모양 (supabase/jobs.sql 과 칸 이름이 같다) */
type TitleRow = { id: number; title: string };
type DetailRow = {
  job_id: number;
  organization: string;
  region: string;
  deadline: string;
  source_url: string | null;
  schedule: string;
  target: string | null;
  headcount: number | null;
  description: string;
  qualifications: string | null;
  documents: string | null;
  apply_url: string | null;
  apply_email: string | null;
  jobs: { title: string } | null;
};

const SUMMARY_COLUMNS = "job_id, organization, region, deadline, jobs!inner(title)";

/** 공고 번호는 숫자만 받는다. 엉뚱한 주소(/jobs/abc)는 데이터베이스에 묻지 않고 '없음'으로 본다. */
function toJobId(id: string): number | null {
  return /^\d{1,15}$/.test(id) ? Number(id) : null;
}

/** 빈칸이나 공백만 있는 칸은 '없음'으로 본다. */
function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toSummary(row: Pick<DetailRow, "job_id" | "organization" | "region" | "deadline" | "jobs">): Job {
  return {
    id: String(row.job_id),
    title: row.jobs?.title ?? "",
    organization: row.organization,
    region: row.region,
    deadline: row.deadline,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`공고를 불러오지 못했습니다 (${what}): ${error.message}`);
}

/** 지원할 수 있는 공고의 번호·제목 — 비회원용. 마감이 지나지 않은 것만, 마감 가까운 순. */
export async function getOpenJobTitles(today: string): Promise<JobTitle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_job_titles", { today });
  if (error) fail("목록", error);
  return (data as TitleRow[]).map((row) => ({ id: String(row.id), title: row.title }));
}

/** 지원할 수 있는 공고 — **회원용**. 마감이 지나지 않은 것만, 마감 가까운 순. */
export async function getOpenJobs(today: string): Promise<Job[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_details")
    .select(SUMMARY_COLUMNS)
    .gte("deadline", today)
    .order("deadline")
    .order("job_id");
  if (error) fail("목록", error);
  return (data as unknown as DetailRow[]).map(toSummary);
}

/** 공고 하나의 번호·제목. 마감이 지난 공고도 돌려준다 (주소로 직접 들어온 경우). 없으면 null. */
export async function getJobTitle(id: string): Promise<JobTitle | null> {
  const jobId = toJobId(id);
  if (jobId === null) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("job_title", { job_id: jobId });
  if (error) fail("제목", error);
  const row = (data as TitleRow[])[0];
  return row ? { id: String(row.id), title: row.title } : null;
}

/** 공고 상세 하나 — **회원용**. 비회원이 부르면 데이터베이스가 아무것도 내주지 않아 null 이 된다. */
export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const jobId = toJobId(id);
  if (jobId === null) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_details")
    .select("*, jobs!inner(title)")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) fail("상세", error);
  if (!data) return null;

  const row = data as unknown as DetailRow;
  return {
    ...toSummary(row),
    sourceUrl: text(row.source_url),
    schedule: row.schedule,
    target: text(row.target),
    headcount: row.headcount ?? undefined,
    description: row.description,
    qualifications: text(row.qualifications),
    documents: text(row.documents),
    applyUrl: text(row.apply_url),
    applyEmail: text(row.apply_email),
  };
}
