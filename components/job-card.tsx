import Link from "next/link";
import { FromRequestBadge } from "@/components/job-detail";
import SaveJobButton from "@/components/save-job-button";
import { daysBetween, formatKoreanDate } from "@/lib/date";
import type { Job, JobTitle } from "@/lib/jobs";

/** 마감까지 이 날 수 이하로 남으면 '마감임박'으로 표시한다. */
export const URGENT_DAYS = 3;

/** 남은 날짜 배지. 목록 카드와 상세 화면이 함께 쓴다. */
export function DeadlineBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) {
    return (
      <span className="shrink-0 rounded-badge bg-line px-2 py-0.5 text-[11px] font-semibold text-muted">
        마감
      </span>
    );
  }

  if (daysLeft <= URGENT_DAYS) {
    return (
      <span className="nums shrink-0 rounded-badge bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
        {daysLeft === 0 ? "D-day" : `마감임박 D-${daysLeft}`}
      </span>
    );
  }

  return (
    <span className="nums shrink-0 rounded-badge bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
      D-{daysLeft}
    </span>
  );
}

/**
 * 공고 카드. 회원은 기관·지역·마감일까지, 비회원은 제목만 받으므로 제목만 보여준다.
 * save 가 있으면 오른쪽 아래에 관심 공고 별 버튼 (강사 회원: 담기, 비회원: 로그인하러 가기, 기관 회원: 없음).
 * 버튼은 카드 링크 바깥에 겹쳐 놓는다 (링크 안에 버튼을 넣으면 누를 때 공고로 넘어가 버림).
 */
export default function JobCard({
  job,
  today,
  save,
}: {
  job: Job | JobTitle;
  today: string;
  save?: { saved: boolean } | { loginNext: string };
}) {
  const summary = "deadline" in job ? job : null;

  return (
    <div className="relative h-full">
      <Link
        href={`/jobs/${job.id}`}
        className="group block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <article className="flex h-full flex-col rounded-card bg-white p-5 transition-transform duration-150 group-active:scale-[0.98]">
          {summary && (
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-muted">
                {summary.fromRequest && <FromRequestBadge />}
                <span className="truncate">{summary.organization}</span>
              </p>
              <DeadlineBadge daysLeft={daysBetween(today, summary.deadline)} />
            </div>
          )}

          <h2 className="line-clamp-2 text-[17px] leading-snug font-bold tracking-tight text-ink">{job.title}</h2>

          {summary ? (
            <p className={`nums mt-auto pt-2 text-[13px] text-muted ${save ? "pr-9" : ""}`}>
              {summary.region} · {formatKoreanDate(summary.deadline)} 마감
            </p>
          ) : (
            <p className={`mt-auto flex items-center gap-1.5 pt-2 text-[13px] text-muted ${save ? "pr-9" : ""}`}>
              <LockIcon />
              기관·지역·마감일은 회원만 볼 수 있어요
            </p>
          )}
        </article>
      </Link>
      {save && (
        <div className="absolute right-2 bottom-2">
          {"loginNext" in save ? (
            <SaveJobButton jobId={job.id} saved={false} size="small" loginNext={save.loginNext} />
          ) : (
            <SaveJobButton jobId={job.id} saved={save.saved} size="small" />
          )}
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
