import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import RequestStatusButtons from "@/components/admin-request-status";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { type AdminRequest, formatPhone, getAllRequests } from "@/lib/admin-requests";
import { formatKoreanDate, todayInSeoul } from "@/lib/date";
import { REQUEST_STATUSES, type RequestStatus, isRequestStatus } from "@/lib/request-status";

export const metadata: Metadata = { title: "강사섭외 의뢰", robots: { index: false, follow: false } };

/** 상태별 배지 색. 접수(새 의뢰)는 눈에 띄게 주황. */
const STATUS_STYLE: Record<RequestStatus, string> = {
  접수: "bg-accent text-white",
  "처리 중": "bg-brand/10 text-brand",
  완료: "bg-bg text-muted",
};

/** 관리자 · 강사섭외 의뢰. 기관이 보낸 의뢰를 보고 처리 상태를 바꾼다. */
export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  await connection();
  if (!(await checkAdmin("/admin/requests"))) return <NotAdminCard />;

  const params = await searchParams;
  const filter = isRequestStatus(params.status) ? params.status : null;

  const today = todayInSeoul();
  const requests = await getAllRequests();
  const shown = filter ? requests.filter((r) => r.status === filter) : requests;
  const count = (s: RequestStatus) => requests.filter((r) => r.status === s).length;

  const chips: { label: string; href: string; active: boolean }[] = [
    { label: "전체", href: "/admin/requests", active: filter === null },
    ...REQUEST_STATUSES.map((s) => ({
      label: s,
      href: `/admin/requests?status=${encodeURIComponent(s)}`,
      active: filter === s,
    })),
  ];

  return (
    <AdminShell active="requests">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사섭외 의뢰</h1>
      <p className="mt-1 text-sm text-muted">기관이 보낸 의뢰예요. 담당자에게 연락한 뒤 처리 상태를 바꿔 주세요.</p>

      {params.failed && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] font-semibold text-warn">
          처리 상태를 바꾸지 못했어요. 잠시 뒤에 다시 시도해 주세요.
        </p>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-3">
        {REQUEST_STATUSES.map((s) => (
          <div key={s} className="rounded-card bg-white p-4 md:p-5">
            <dt className="text-[13px] font-medium text-muted">{s === "접수" ? "새 의뢰 (접수)" : s}</dt>
            <dd className={`nums mt-1 text-[26px] font-bold tracking-tight ${s === "접수" && count(s) > 0 ? "text-accent" : "text-ink"}`}>
              {count(s)}
              <span className="ml-0.5 text-[15px] font-semibold text-muted">건</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            aria-current={c.active ? "true" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-badge px-4 text-[14px] font-semibold ${
              c.active ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted">
        <span className="nums font-semibold text-ink">{shown.length}</span>건 · 최근에 받은 순
      </p>

      {shown.length === 0 ? (
        <p className="mt-3 rounded-card bg-white p-5 text-center text-sm text-muted">
          {filter ? `'${filter}' 상태인 의뢰가 없어요.` : "아직 받은 의뢰가 없어요."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shown.map((r) => (
            <RequestCard key={r.id} request={r} today={today} />
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function RequestCard({ request: r, today }: { request: AdminRequest; today: string }) {
  const details: [string, string | undefined][] = [
    ["희망 일정", r.schedule],
    ["수업 대상", r.target],
    ["필요한 강사 수", r.headcount ? `${r.headcount}명` : undefined],
    ["예산·강사료", r.budget],
    ["요청 사항", r.message],
  ];

  return (
    <li className="rounded-card bg-white p-5 md:p-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
        <span className="nums">
          {r.receivedDate === today ? "오늘" : formatKoreanDate(r.receivedDate)} 받음 · {r.id}번
        </span>
      </div>

      <h2 className="mt-2 text-[18px] font-bold tracking-tight text-ink">
        {r.orgName}
        <span className="ml-2 align-middle text-[13px] font-medium text-muted">
          {r.orgType} · {r.region}
        </span>
      </h2>
      <p className="mt-1 text-[15px] font-semibold text-brand">{r.subject}</p>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14px] md:grid-cols-[120px_minmax(0,1fr)]">
        {details
          .filter((d): d is [string, string] => Boolean(d[1]))
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-muted">{label}</dt>
              <dd className="mb-2 whitespace-pre-line text-ink md:mb-0">{value}</dd>
            </div>
          ))}
      </dl>

      <div className="mt-4 flex flex-col gap-1 rounded-control bg-bg px-4 py-3 text-[14px] md:flex-row md:flex-wrap md:items-center md:gap-x-5">
        <span className="font-semibold text-ink">담당자 {r.contactName}</span>
        <a href={`tel:${r.contactPhone}`} className="nums font-semibold text-brand hover:underline">
          {formatPhone(r.contactPhone)}
        </a>
        <a href={`mailto:${r.contactEmail}`} className="break-all font-semibold text-brand hover:underline">
          {r.contactEmail}
        </a>
      </div>

      <div className="mt-4 md:max-w-[360px]">
        <RequestStatusButtons id={r.id} status={r.status} />
      </div>
    </li>
  );
}
