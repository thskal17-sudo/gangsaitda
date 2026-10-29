import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { type DailyStat, getSiteStats, type SiteStats, STATS_DAYS } from "@/lib/admin-stats";
import { formatKoreanDate, mondayOf, todayInSeoul } from "@/lib/date";

// 관리자 화면은 검색 결과에 나오지 않게 한다.
export const metadata: Metadata = { title: "현황", robots: { index: false, follow: false } };

const sum = (days: DailyStat[], key: "views" | "members" | "requests") => days.reduce((n, d) => n + d[key], 0);

/** 관리자 · 현황(대시보드). 관리자 화면에 들어오면 가장 먼저 보이는 화면. */
export default async function AdminDashboardPage() {
  await connection();

  // 로그인 안 했으면 로그인 화면으로, 관리자가 아니면 안내만 보여준다.
  if (!(await checkAdmin("/admin"))) return <NotAdminCard />;

  const today = todayInSeoul();
  const stats = await getSiteStats(today);

  return (
    <AdminShell active="dashboard">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">현황</h1>
      <p className="nums mt-1 text-sm text-muted">{formatKoreanDate(today)} 기준</p>

      {stats ? <Dashboard stats={stats} today={today} /> : <SetupNotice />}
    </AdminShell>
  );
}

function Dashboard({ stats, today }: { stats: SiteStats; today: string }) {
  const todayStat = stats.daily.find((d) => d.date === today);
  const yesterday = stats.daily.at(-2);
  const thisWeek = stats.daily.filter((d) => d.date >= mondayOf(today));

  const tiles = [
    {
      label: "오늘 열람",
      value: todayStat?.views ?? 0,
      unit: "회",
      sub: `어제 ${(yesterday?.views ?? 0).toLocaleString("ko-KR")}회`,
    },
    { label: "이번 주 열람", value: sum(thisWeek, "views"), unit: "회", sub: "월요일부터 오늘까지" },
    {
      label: "새 가입자",
      value: todayStat?.members ?? 0,
      unit: "명",
      sub: `이번 주 ${sum(thisWeek, "members")}명`,
      href: "/admin/members",
    },
    {
      label: "새 강사섭외 의뢰",
      value: todayStat?.requests ?? 0,
      unit: "건",
      sub: `이번 주 ${sum(thisWeek, "requests")}건`,
      href: "/admin/requests",
    },
  ];

  return (
    <>
      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const inner = (
            <>
              <dt className="text-[13px] font-medium text-muted">{t.label}</dt>
              <dd className="nums mt-1 text-[26px] font-bold tracking-tight text-ink">
                {t.value.toLocaleString("ko-KR")}
                <span className="ml-0.5 text-[15px] font-semibold text-muted">{t.unit}</span>
              </dd>
              <dd className="nums mt-0.5 text-[13px] text-muted">{t.sub}</dd>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-card bg-white p-4 transition-colors hover:bg-white/70 md:p-5">
              {inner}
            </Link>
          ) : (
            <div key={t.label} className="rounded-card bg-white p-4 md:p-5">
              {inner}
            </div>
          );
        })}
      </dl>
      <p className="mt-2 text-[13px] text-muted">
        열람 수는 사이트 화면이 열린 횟수예요. 누가 왔는지는 적지 않아서, 한 사람이 여러 번 열면 여러 번 셉니다. 관리자 화면은 세지 않아요.
      </p>

      <ViewsChart days={stats.daily} today={today} />

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <section className="rounded-card bg-white p-5 md:p-6">
          <h2 className="text-[18px] font-bold tracking-tight">많이 본 공고</h2>
          <p className="mt-0.5 text-[13px] text-muted">최근 {STATS_DAYS}일 · 공고 화면이 열린 횟수</p>
          {stats.topJobs.length === 0 ? (
            <Empty />
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {stats.topJobs.map((job, i) => (
                <li key={job.id} className="flex items-center gap-3 py-3">
                  <span className="nums w-5 shrink-0 text-[15px] font-bold text-muted">{i + 1}</span>
                  <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink hover:underline">
                    {job.title}
                  </Link>
                  <span className="nums shrink-0 text-[14px] text-muted">{job.count.toLocaleString("ko-KR")}회</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-card bg-white p-5 md:p-6">
          <h2 className="text-[18px] font-bold tracking-tight">들어온 경로</h2>
          <p className="mt-0.5 text-[13px] text-muted">최근 {STATS_DAYS}일 · 사이트에 처음 들어온 곳</p>
          {stats.sources.length === 0 ? <Empty /> : <SourceBars sources={stats.sources} />}
        </section>
      </div>
    </>
  );
}

/** 최근 14일 날짜별 열람 수 막대그래프. 막대에 손가락·마우스를 올리면 그날 숫자가 보인다. */
function ViewsChart({ days, today }: { days: DailyStat[]; today: string }) {
  const peak = Math.max(0, ...days.map((d) => d.views));
  const max = Math.max(1, peak);
  const total = sum(days, "views");

  return (
    <section className="mt-4 rounded-card bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-[18px] font-bold tracking-tight">최근 {STATS_DAYS}일 열람 수</h2>
        <p className="nums text-[13px] text-muted">
          합계 <span className="font-semibold text-ink">{total.toLocaleString("ko-KR")}</span>회 · 하루 최대 {peak.toLocaleString("ko-KR")}회
        </p>
      </div>

      <ul className="mt-10 flex h-40 items-end gap-1 border-b border-line md:gap-2" aria-label="날짜별 열람 수">
        {days.map((d) => (
          <li key={d.date} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
            <span
              className={`w-full rounded-t-[4px] ${d.date === today ? "bg-brand" : "bg-brand/55"} group-hover:bg-brand group-focus:bg-brand`}
              style={{ height: d.views > 0 ? `max(3px, ${(d.views / max) * 100}%)` : 0 }}
            />
            {/* 막대에 올렸을 때 보이는 숫자 */}
            <span
              role="tooltip"
              className="nums pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white group-hover:block group-focus:block"
            >
              {formatKoreanDate(d.date)} {d.views.toLocaleString("ko-KR")}회
            </span>
            <span className="sr-only">
              {formatKoreanDate(d.date)} {d.views}회
            </span>
          </li>
        ))}
      </ul>
      <div className="nums mt-2 flex gap-1 text-center text-[11px] text-muted md:gap-2" aria-hidden="true">
        {days.map((d, i) => {
          const [, month, day] = d.date.split("-").map(Number);
          return (
            <span key={d.date} className={`flex-1 ${d.date === today ? "font-bold text-ink" : ""}`}>
              {i === 0 || day === 1 ? `${month}/${day}` : day}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function SourceBars({ sources }: { sources: { label: string; count: number }[] }) {
  const total = sources.reduce((n, s) => n + s.count, 0);
  const max = Math.max(1, ...sources.map((s) => s.count));
  return (
    <ul className="mt-4 space-y-3">
      {sources.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="font-semibold text-ink">{s.label}</span>
            <span className="nums text-muted">
              {s.count.toLocaleString("ko-KR")}회 · {Math.round((s.count / total) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-badge bg-bg">
            <div className="h-2 rounded-badge bg-brand" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">아직 모인 기록이 없어요.</p>;
}

/** 데이터베이스에 열람 수 표를 아직 만들지 않았을 때 */
function SetupNotice() {
  return (
    <div className="mt-5 rounded-card bg-white p-5 md:p-6">
      <h2 className="text-[18px] font-bold tracking-tight">현황 숫자를 아직 볼 수 없어요</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Supabase 관리 화면 → SQL Editor 에 <code className="rounded bg-bg px-1.5 py-0.5 text-ink">supabase/page-views.sql</code> 내용을
        붙여넣고 Run 을 한 번 눌러 주세요. 그다음부터 화면이 열린 횟수가 쌓이기 시작합니다.
      </p>
    </div>
  );
}
