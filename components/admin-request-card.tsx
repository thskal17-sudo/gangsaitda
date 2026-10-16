import type { ReactNode } from "react";
import { type AdminRequest, formatPhone } from "@/lib/admin-requests";
import { formatKoreanDate } from "@/lib/date";
import type { RequestStatus } from "@/lib/request-status";

/* 관리자 · 강사섭외 의뢰 카드. 의뢰 목록과 의뢰 상세 화면이 함께 쓴다. */

/** 상태별 배지 색. 접수(새 의뢰)는 눈에 띄게 주황. */
export const STATUS_STYLE: Record<RequestStatus, string> = {
  접수: "bg-accent text-white",
  "처리 중": "bg-brand/10 text-brand",
  완료: "bg-bg text-muted",
};

export default function RequestCard({
  request: r,
  today,
  children,
}: {
  request: AdminRequest;
  today: string;
  /** 카드 맨 아래에 붙일 내용 (처리 상태 버튼, 추천 강사 요약 등) */
  children?: ReactNode;
}) {
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
        <span
          className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${r.verifiedDate ? "bg-ok/10 text-ok" : "bg-bg text-muted"}`}
        >
          {r.verifiedDate ? "기관 확인됨" : "기관 확인 전"}
        </span>
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

      {children}
    </li>
  );
}
