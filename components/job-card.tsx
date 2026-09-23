import { daysBetween, formatKoreanDate } from "@/lib/date";
import type { Job } from "@/lib/jobs";

/** 마감까지 이 날 수 이하로 남으면 '마감임박'으로 표시한다. */
const URGENT_DAYS = 3;

function DeadlineBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= URGENT_DAYS) {
    return (
      <span className="nums shrink-0 rounded-badge bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
        {daysLeft === 0 ? "오늘 마감" : `마감임박 D-${daysLeft}`}
      </span>
    );
  }

  return (
    <span className="nums shrink-0 rounded-badge border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
      D-{daysLeft}
    </span>
  );
}

export default function JobCard({ job, today }: { job: Job; today: string }) {
  return (
    <article className="flex h-full flex-col rounded-card border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-medium text-muted">{job.organization}</p>
        <DeadlineBadge daysLeft={daysBetween(today, job.deadline)} />
      </div>

      <h2 className="mt-1.5 line-clamp-2 text-base leading-snug font-semibold text-ink">
        {job.title}
      </h2>

      <p className="nums mt-auto pt-2 text-[13px] text-muted">
        {job.region} · {formatKoreanDate(job.deadline)} 마감
      </p>
    </article>
  );
}
