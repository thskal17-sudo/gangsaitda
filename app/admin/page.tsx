import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminBarChart, { type Bar } from "@/components/admin-bar-chart";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import {
  DEFAULT_DAYS,
  type DailyStat,
  type Growth,
  type GrowthBucket,
  getGrowth,
  getSiteStats,
  type Period,
  PERIODS,
  type SiteStats,
  toPeriod,
} from "@/lib/admin-stats";
import { formatKoreanDate, mondayOf, todayInSeoul } from "@/lib/date";

// 관리자 화면은 검색 결과에 나오지 않게 한다.
export const metadata: Metadata = { title: "현황", robots: { index: false, follow: false } };

const sum = (days: DailyStat[], key: "views" | "members" | "requests") => days.reduce((n, d) => n + d[key], 0);

/** 관리자 · 현황(대시보드). 관리자 화면에 들어오면 가장 먼저 보이는 화면. */
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  await connection();

  // 로그인 안 했으면 로그인 화면으로, 관리자가 아니면 안내만 보여준다.
  if (!(await checkAdmin("/admin"))) return <NotAdminCard />;

  const period = toPeriod((await searchParams).days);
  const today = todayInSeoul();
  const [stats, growth] = await Promise.all([getSiteStats(today, period), getGrowth(today)]);

  return (
    <AdminShell active="dashboard">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">현황</h1>
      <p className="nums mt-1 text-sm text-muted">{formatKoreanDate(today)} 기준</p>

      {stats ? <Dashboard stats={stats} today={today} period={period} /> : <SetupNotice />}
      {growth && <GrowthCharts growth={growth} />}
    </AdminShell>
  );
}

function Dashboard({ stats, today, period }: { stats: SiteStats; today: string; period: Period }) {
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

      {/* 기간 고르기: 아래 그래프·많이 본 공고·들어온 경로·사이트·홍보 링크에 함께 적용 (위 숫자 네 칸은 그대로) */}
      <nav aria-label="기간" className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[14px] font-semibold text-muted">최근</span>
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={p === DEFAULT_DAYS ? "/admin" : `/admin?days=${p}`}
            aria-current={p === period ? "true" : undefined}
            className={`nums flex h-9 items-center rounded-badge px-4 text-[14px] font-semibold ${
              p === period ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"
            }`}
          >
            {p}일
          </Link>
        ))}
      </nav>

      <ViewsChart days={stats.daily} />

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <section className="rounded-card bg-white p-5 md:p-6">
          <h2 className="text-[18px] font-bold tracking-tight">많이 본 공고</h2>
          <p className="mt-0.5 text-[13px] text-muted">최근 {period}일 · 공고 화면이 열린 횟수</p>
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
          <p className="mt-0.5 text-[13px] text-muted">최근 {period}일 · 사이트에 처음 들어온 곳의 종류</p>
          {stats.sources.length === 0 ? <Empty /> : <SourceBars sources={stats.sources} />}
        </section>

        <section className="rounded-card bg-white p-5 md:p-6">
          <h2 className="text-[18px] font-bold tracking-tight">들어온 사이트 자세히</h2>
          <p className="mt-0.5 text-[13px] text-muted">최근 {period}일 · 바로 전에 보던 사이트 이름 (많은 순 20개)</p>
          {stats.hosts.length === 0 ? (
            <Empty />
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {stats.hosts.map((h) => (
                <li key={h.host} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{h.host}</span>
                    <span className="block text-[12px] text-muted">{h.kind}</span>
                  </span>
                  <span className="nums shrink-0 text-[14px] text-muted">{h.count.toLocaleString("ko-KR")}회</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            휴대폰 앱(카카오톡·인스타 등) 안에서 누른 링크는 사이트 이름이 남지 않아 여기에는 없고, 위 &lsquo;들어온 경로&rsquo;에만 셉니다.
          </p>
        </section>

        <CampaignCard campaigns={stats.campaigns} period={period} />
      </div>
    </>
  );
}

/** 날짜별 열람 수 막대그래프. 45일이 넘으면 한 주씩 묶는다. */
function ViewsChart({ days }: { days: DailyStat[] }) {
  const peak = Math.max(0, ...days.map((d) => d.views));
  const total = sum(days, "views");
  const weekly = days.length > 45;

  // 한 주씩 묶기 (월요일 시작). 첫 주는 기간 첫날부터.
  const points: { start: string; views: number }[] = [];
  for (const d of days) {
    const key = weekly ? mondayOf(d.date) : d.date;
    const last = points.at(-1);
    if (last && (weekly ? mondayOf(last.start) === key : last.start === key)) last.views += d.views;
    else points.push({ start: d.date, views: d.views });
  }
  const n = points.length;
  // 날짜 글씨: 하루씩 14개 이하면 막대마다, 그보다 많거나 한 주 단위면 6~7개만
  const step = !weekly && n <= 14 ? 1 : Math.ceil(n / 7);

  const bars: Bar[] = points.map((p, i) => {
    const [, month, day] = p.start.split("-").map(Number);
    const labeled = (n - 1 - i) % step === 0;
    const count = `${p.views.toLocaleString("ko-KR")}회`;
    return {
      key: p.start,
      value: p.views,
      // 기간 첫날이 월요일이 아니면 첫 막대는 한 주가 다 차지 않는다.
      tooltip: weekly
        ? `${month}월 ${day}일부터 ${mondayOf(p.start) === p.start ? "한 주" : "그 주 일요일까지"} ${count}`
        : `${formatKoreanDate(p.start)} ${count}`,
      axisLabel: !labeled ? undefined : step === 1 && i !== 0 && day !== 1 ? String(day) : `${month}/${day}`,
      current: i === n - 1,
    };
  });

  return (
    <section className="mt-4 rounded-card bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-[18px] font-bold tracking-tight">최근 {days.length}일 열람 수</h2>
        <p className="nums text-[13px] text-muted">
          합계 <span className="font-semibold text-ink">{total.toLocaleString("ko-KR")}</span>회 · 하루 최대 {peak.toLocaleString("ko-KR")}회
        </p>
      </div>
      {weekly && <p className="mt-0.5 text-[13px] text-muted">막대 하나가 한 주 (월~일)</p>}
      <AdminBarChart label="날짜별 열람 수" bars={bars} />
    </section>
  );
}

/** 홍보 링크(?from=이름)별 들어온 수와 쓰는 법 */
function CampaignCard({ campaigns, period }: { campaigns: SiteStats["campaigns"]; period: Period }) {
  return (
    <section className="rounded-card bg-white p-5 md:p-6">
      <h2 className="text-[18px] font-bold tracking-tight">홍보 링크별</h2>
      <p className="mt-0.5 text-[13px] text-muted">최근 {period}일 · 이름표를 붙인 링크로 들어온 수</p>
      {campaigns.length === 0 ? (
        <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">아직 이름표를 붙인 링크로 들어온 기록이 없어요.</p>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {campaigns.map((c) => (
            <li key={c.name} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{c.name}</span>
              <span className="nums shrink-0 text-[14px] text-muted">{c.count.toLocaleString("ko-KR")}회</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 rounded-control bg-bg p-4 text-[13px] leading-relaxed text-muted">
        <p className="font-semibold text-ink">쓰는 법</p>
        <p className="mt-1">
          블로그·카페·문자·카톡 채널에 사이트 주소를 올릴 때 끝에 <code className="whitespace-nowrap text-ink">?from=이름</code> 을 붙이세요. 그 링크로 들어온 수가
          이름별로 여기에 쌓입니다.
        </p>
        <p className="mt-1 break-all">
          예: <code className="text-ink">https://www.gangsaitda.com/?from=블로그1</code>
          <br />
          공고 링크도 됩니다: <code className="text-ink">https://www.gangsaitda.com/jobs/123?from=문자11월</code>
        </p>
      </div>
    </section>
  );
}

const UNIT_LABEL = { day: "하루", week: "한 주", month: "한 달" } as const;

/** 추이 그래프 아래에 적는 날짜 글씨 수 (대략) */
const AXIS_LABELS = 6;

/** 가입자·강사섭외 의뢰 추이 (첫 기록부터 지금까지). 두 숫자는 크기가 달라 그래프를 따로 그린다. */
function GrowthCharts({ growth }: { growth: Growth }) {
  const charts = [
    { title: "가입자 추이", key: "members", unit: "명", total: growth.totalMembers, href: "/admin/members" },
    { title: "강사섭외 의뢰 추이", key: "requests", unit: "건", total: growth.totalRequests, href: "/admin/requests" },
  ] as const;

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
      {charts.map((c) => (
        <section key={c.key} className="rounded-card bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="text-[18px] font-bold tracking-tight">
              <Link href={c.href} className="hover:underline">
                {c.title}
              </Link>
            </h2>
            <p className="nums text-[13px] text-muted">
              누적 <span className="font-semibold text-ink">{c.total.toLocaleString("ko-KR")}</span>
              {c.unit}
            </p>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">처음부터 지금까지 · 막대 하나가 {UNIT_LABEL[growth.unit]}</p>
          <AdminBarChart
            label={c.title}
            bars={growth.buckets.map((b, i) => growthBar(b, i, growth, b[c.key], c.unit))}
          />
        </section>
      ))}
    </div>
  );
}

function growthBar(b: GrowthBucket, i: number, growth: Growth, value: number, unit: string): Bar {
  const [year, month, day] = b.start.split("-").map(Number);
  const isLast = i === growth.buckets.length - 1;
  const count = `${value.toLocaleString("ko-KR")}${unit}`;
  // 날짜 글씨는 막대 몇 개마다 하나씩, 맨 끝(오늘)부터 거꾸로 세어 고르게 적는다 (6개 안팎).
  const n = growth.buckets.length;
  const labeled = (n - 1 - i) % Math.ceil(n / AXIS_LABELS) === 0;

  if (growth.unit === "day") {
    return {
      key: b.start,
      value,
      tooltip: `${formatKoreanDate(b.start)} ${count}`,
      axisLabel: labeled ? `${month}/${day}` : undefined,
      current: isLast,
    };
  }
  if (growth.unit === "week") {
    return {
      key: b.start,
      value,
      tooltip: `${month}월 ${day}일부터 한 주 ${count}`,
      axisLabel: labeled ? `${month}/${day}` : undefined,
      current: isLast,
    };
  }
  return {
    key: b.start,
    value,
    tooltip: `${year}년 ${month}월 ${count}`,
    axisLabel: labeled ? `${year % 100}.${month}` : undefined,
    current: isLast,
  };
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
