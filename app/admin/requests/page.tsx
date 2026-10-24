import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import RequestCard from "@/components/admin-request-card";
import RequestStatusButtons from "@/components/admin-request-status";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { getAllRequests, getFeedbacks, getMatchCounts, getPostingStatuses } from "@/lib/admin-requests";
import { todayInSeoul } from "@/lib/date";
import { REQUEST_STATUSES, type RequestStatus, isRequestStatus } from "@/lib/request-status";

export const metadata: Metadata = { title: "강사섭외 의뢰", robots: { index: false, follow: false } };

/** 관리자 · 강사섭외 의뢰. 기관이 보낸 의뢰를 보고 처리 상태를 바꾼다. */
export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  await connection();
  if (!(await checkAdmin("/admin/requests"))) return <NotAdminCard />;

  const params = await searchParams;
  const filter = isRequestStatus(params.status) ? params.status : null;

  const today = todayInSeoul();
  const [requests, matchCounts, postings, feedbacks] = await Promise.all([getAllRequests(), getMatchCounts(), getPostingStatuses(), getFeedbacks()]);
  const reviewCount = [...postings.values()].filter((p) => p.status === "검토 중").length;
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
      <p className="mt-1 text-sm text-muted">
        기관이 보낸 의뢰예요. 담당자에게 연락한 뒤 처리 상태를 바꾸고, &lsquo;추천 강사 관리&rsquo;에서 기관 확인과 강사 추천을 해 주세요.
      </p>

      {params.failed && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] font-semibold text-warn">
          처리 상태를 바꾸지 못했어요. 잠시 뒤에 다시 시도해 주세요.
        </p>
      )}
      {reviewCount > 0 && (
        <p role="status" className="mt-4 rounded-card bg-accent/10 px-5 py-4 text-[15px] font-semibold text-accent">
          기관이 낸 모집 공고 <span className="nums">{reviewCount}</span>건이 검토를 기다려요. 아래 &lsquo;공고 검토 요청&rsquo; 표시가 붙은 의뢰의 &lsquo;추천 강사 관리&rsquo;에서 승인하거나 반려해 주세요.
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
          {shown.map((r) => {
            const m = matchCounts.get(r.id);
            const posting = postings.get(r.id);
            return (
              <RequestCard key={r.id} request={r} today={today} posting={posting} feedback={feedbacks.get(r.id)}>
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="md:w-[360px]">
                    <RequestStatusButtons id={r.id} status={r.status} />
                  </div>
                  <Link
                    href={`/admin/requests/${r.id}`}
                    className="flex h-11 items-center justify-center gap-2 rounded-control bg-brand/10 px-4 text-[14px] font-semibold text-brand hover:bg-brand/15"
                  >
                    추천 강사 관리
                    <span className="nums font-medium text-brand/80">
                      {m
                        ? `${m.total}명${m.applied ? ` · 지원 ${m.applied}` : ""}${m.chosen ? ` · 기관 선택 ${m.chosen}` : ""}${m.confirmed ? ` · 확정 ${m.confirmed}` : ""}`
                        : "아직 없음"}
                    </span>
                    →
                  </Link>
                </div>
              </RequestCard>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
