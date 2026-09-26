import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import HideButton from "@/components/admin-hide-button";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { DeadlineBadge } from "@/components/job-card";
import { type AdminJob, checkAdmin, getAllJobsForAdmin } from "@/lib/admin";
import { daysBetween, formatKoreanDate, todayInSeoul } from "@/lib/date";

// 관리자 화면은 검색 결과에 나오지 않게 한다.
export const metadata: Metadata = { title: "공고 관리", robots: { index: false, follow: false } };

/** 마감까지 이 날 수 이하로 남은 공고를 '곧 마감'으로 센다 (공고 카드의 '마감임박'과 같은 기준). */
const SOON_DAYS = 3;

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "open", label: "모집 중" },
  { key: "today", label: "오늘 올린 공고" },
  { key: "closed", label: "마감" },
  { key: "hidden", label: "숨김" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function toFilter(value: string | string[] | undefined): FilterKey {
  return FILTERS.some((f) => f.key === value) ? (value as FilterKey) : "all";
}

/** 숨긴 공고는 '전체'와 '숨김'에서만 보이고, 숫자 요약에도 세지 않는다 (사이트에 안 보이므로). */
function matchesFilter(job: AdminJob, filter: FilterKey, today: string): boolean {
  if (filter === "all") return true;
  if (filter === "hidden") return job.hidden;
  if (job.hidden) return false;
  switch (filter) {
    case "open":
      return job.deadline !== undefined && job.deadline >= today;
    case "closed":
      return job.deadline !== undefined && job.deadline < today;
    case "today":
      return job.createdDate === today;
    default:
      return true;
  }
}

function matchesSearch(job: AdminJob, q: string): boolean {
  if (!q) return true;
  return [job.title, job.organization, job.region].some((v) => v?.toLowerCase().includes(q.toLowerCase()));
}

/** 관리자 · 공고 관리. 마감된 공고, 숨긴 공고까지 모든 공고를 보고 수정·숨기기를 한다. */
export default async function AdminJobsPage({ searchParams }: PageProps<"/admin">) {
  await connection();

  // 로그인 안 했으면 로그인 화면으로, 관리자가 아니면 안내만 보여준다.
  if (!(await checkAdmin("/admin"))) return <NotAdminCard />;

  const params = await searchParams;
  const filter = toFilter(params.filter);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 50) : "";

  const today = todayInSeoul();
  const jobs = await getAllJobsForAdmin();
  // 공고 등록·수정 화면에서 막 저장하고 돌아온 경우 (?created=공고번호, ?updated=공고번호)
  const created = jobs.find((job) => job.id === params.created);
  const updated = jobs.find((job) => job.id === params.updated);
  const shown = jobs.filter((job) => matchesFilter(job, filter, today) && matchesSearch(job, q));

  const stats = [
    { label: "전체 공고", value: jobs.length },
    { label: "모집 중", value: jobs.filter((j) => matchesFilter(j, "open", today)).length },
    { label: "오늘 올린 공고", value: jobs.filter((j) => matchesFilter(j, "today", today)).length },
    {
      label: `${SOON_DAYS}일 안에 마감`,
      value: jobs.filter((j) => !j.hidden && j.deadline && daysBetween(today, j.deadline) >= 0 && daysBetween(today, j.deadline) <= SOON_DAYS).length,
      accent: true,
    },
  ];

  /** 걸러 보기 버튼을 눌러도 검색어는 그대로 둔다. */
  const filterHref = (key: FilterKey) => {
    const sp = new URLSearchParams();
    if (key !== "all") sp.set("filter", key);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  return (
    <AdminShell active="jobs">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">공고 관리</h1>
      <p className="mt-1 text-sm text-muted">마감된 공고, 숨긴 공고까지 모든 공고를 볼 수 있어요.</p>

      {created && <Notice job={created} message="공고를 올렸어요." />}
      {updated && <Notice job={updated} message="공고를 고쳤어요." />}
      {params.failed === "hide" && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] font-semibold text-warn">
          숨기기·다시 올리기를 하지 못했어요. 잠시 뒤에 다시 시도해 주세요.
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-white p-4 md:p-5">
            <dt className="text-[13px] font-medium text-muted">{s.label}</dt>
            <dd className={`nums mt-1 text-[26px] font-bold tracking-tight ${s.accent && s.value > 0 ? "text-accent" : "text-ink"}`}>
              {s.value}
              <span className="ml-0.5 text-[15px] font-semibold text-muted">건</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-card bg-white p-4 md:p-5">
        {/* 검색: 제목·기관·지역에서 찾는다. 걸러 보기 상태는 유지한다. */}
        <form action="/admin" className="flex gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="제목·기관·지역으로 찾기"
            aria-label="공고 검색"
            className="h-12 min-w-0 flex-1 rounded-control bg-bg px-4 text-[15px] text-ink placeholder:text-muted focus:outline-2 focus:outline-brand"
          />
          <button type="submit" className="h-12 shrink-0 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand/90">
            찾기
          </button>
        </form>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={filterHref(f.key)}
              aria-current={f.key === filter ? "true" : undefined}
              className={`flex h-9 shrink-0 items-center rounded-badge px-4 text-[14px] font-semibold ${
                f.key === filter ? "bg-ink text-white" : "bg-bg text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <p className="mt-4 text-sm text-muted">
          {q && <>&lsquo;{q}&rsquo; 검색 결과 · </>}
          <span className="nums font-semibold text-ink">{shown.length}</span>건
        </p>

        {shown.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">조건에 맞는 공고가 없어요.</p>
        ) : (
          <>
            {/* PC 에서만 보이는 칸 이름 */}
            <div className={`mt-3 hidden gap-4 border-b border-line pb-2 text-[13px] font-semibold text-muted md:grid ${ROW_COLUMNS}`}>
              <span>공고</span>
              <span>마감</span>
              <span>상태</span>
              <span>관리</span>
            </div>
            <ul className="divide-y divide-line">
              {shown.map((job) => (
                <AdminJobRow key={job.id} job={job} today={today} />
              ))}
            </ul>
          </>
        )}
      </div>
    </AdminShell>
  );
}

/** PC 에서 목록 칸 너비: 공고 · 마감 · 상태 · 관리 */
const ROW_COLUMNS = "md:grid-cols-[minmax(0,1fr)_180px_72px_172px]";

function Notice({ job, message }: { job: AdminJob; message: string }) {
  return (
    <p role="status" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-ok/10 px-5 py-4 text-[15px] text-ok">
      <span className="min-w-0 font-semibold">
        &lsquo;{job.title}&rsquo; {message}
      </span>
      {!job.hidden && (
        <Link href={`/jobs/${job.id}`} className="font-semibold underline underline-offset-2">
          사이트에서 보기
        </Link>
      )}
    </p>
  );
}

function AdminJobRow({ job, today }: { job: AdminJob; today: string }) {
  const daysLeft = job.deadline ? daysBetween(today, job.deadline) : null;
  const state = job.hidden
    ? { label: "숨김", className: "bg-ink/8 text-ink" }
    : daysLeft === null
      ? { label: "상세 없음", className: "bg-bg text-warn" }
      : daysLeft < 0
        ? { label: "마감", className: "bg-bg text-muted" }
        : { label: "모집 중", className: "bg-ok/10 text-ok" };

  return (
    <li className={`py-4 md:grid md:items-center md:gap-4 ${ROW_COLUMNS}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/jobs/${job.id}`} className="truncate text-[16px] font-bold tracking-tight text-ink hover:underline">
            {job.title}
          </Link>
          {job.createdDate === today && (
            <span className="shrink-0 rounded-badge bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">NEW</span>
          )}
        </div>
        <p className="nums mt-0.5 truncate text-[13px] text-muted">
          {job.region ? `${job.region} · ` : ""}
          {job.organization ?? "기관 정보 없음"} · {formatKoreanDate(job.createdDate)} 올림
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2 md:mt-0">
        {job.deadline && daysLeft !== null ? (
          <>
            <span className="nums text-[14px] text-ink">{formatKoreanDate(job.deadline)}</span>
            <DeadlineBadge daysLeft={daysLeft} />
          </>
        ) : (
          <span className="text-[14px] text-muted">—</span>
        )}
        <span className={`ml-auto rounded-badge px-2.5 py-0.5 text-[12px] font-semibold md:hidden ${state.className}`}>{state.label}</span>
      </div>

      <span className={`hidden w-fit rounded-badge px-2.5 py-0.5 text-[12px] font-semibold md:inline-block ${state.className}`}>
        {state.label}
      </span>

      <div className="mt-3 flex gap-2 md:mt-0">
        <Link
          href={`/admin/jobs/${job.id}/edit`}
          className="flex h-9 items-center rounded-control bg-bg px-3 text-[14px] font-semibold text-ink transition-colors hover:bg-line"
        >
          수정
        </Link>
        <HideButton id={job.id} hidden={job.hidden} />
      </div>
    </li>
  );
}
