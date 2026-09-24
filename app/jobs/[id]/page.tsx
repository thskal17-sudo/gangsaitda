import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DeadlineBadge } from "@/components/job-card";
import {
  ApplyActions,
  ClosedNotice,
  FactList,
  LineList,
  MembersOnlyNotice,
  TextSection,
} from "@/components/job-detail";
import { daysBetween, formatKoreanDate, todayInSeoul } from "@/lib/date";
import { getJob, getJobDetail } from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id, todayInSeoul());
  return { title: job ? job.title : "공고를 찾을 수 없습니다" };
}

export default async function JobDetailPage({ params }: PageProps<"/jobs/[id]">) {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const { id } = await params;
  const today = todayInSeoul();

  const job = await getJob(id, today);
  if (!job) notFound();

  // 상세 내용은 회원일 때만 꺼낸다. 비회원에게는 화면에서 가리는 게 아니라 아예 보내지 않는다.
  const member = await getCurrentMember();
  const detail = member ? await getJobDetail(id, today) : null;

  const daysLeft = daysBetween(today, job.deadline);

  return (
    <article>
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        공고 목록
      </Link>

      <header className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-muted">{job.organization}</p>
          <DeadlineBadge daysLeft={daysLeft} />
        </div>
        <h1 className="mt-1.5 text-[22px] leading-snug font-bold md:text-[28px]">{job.title}</h1>
      </header>

      {/* 휴대폰: 요약 → 본문 순서로 한 줄. PC: 왼쪽 본문, 오른쪽 요약(스크롤해도 따라옴). */}
      <div className="mt-5 grid gap-4 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <aside className="rounded-card border border-line bg-white p-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
          <FactList
            facts={[
              { label: "지역", value: job.region },
              { label: "마감", value: formatKoreanDate(job.deadline) },
              { label: "강사료", value: detail?.pay },
              { label: "수업 일정", value: detail?.schedule },
              { label: "수업 대상", value: detail?.target },
              { label: "모집 인원", value: detail?.headcount ? `${detail.headcount}명` : undefined },
            ]}
          />
          {detail && (daysLeft < 0 ? <ClosedNotice /> : <ApplyActions job={detail} />)}
        </aside>

        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
          {detail ? (
            <>
              <TextSection title="상세 내용">
                <p className="whitespace-pre-line">{detail.description}</p>
              </TextSection>
              {detail.qualifications && (
                <TextSection title="지원 자격">
                  <LineList text={detail.qualifications} />
                </TextSection>
              )}
            </>
          ) : (
            <MembersOnlyNotice next={`/jobs/${job.id}`} />
          )}
        </div>
      </div>
    </article>
  );
}
