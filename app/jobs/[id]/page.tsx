import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DeadlineBadge } from "@/components/job-card";
import {
  ApplyActions,
  ClosedNotice,
  FactList,
  FromRequestBadge,
  LineList,
  MembersOnlyNotice,
  PostingApply,
  SourceLink,
  TextSection,
} from "@/components/job-detail";
import { daysBetween, formatKoreanDate, todayInSeoul } from "@/lib/date";
import { getJobDetail, getJobTitle } from "@/lib/jobs";
import { getMyApplication } from "@/lib/apply";
import { getCurrentMember, getMemberType } from "@/lib/member";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobTitle(id);
  // 검색 결과에 보이는 설명. 공고 내용은 회원만 보므로 제목과 안내 문구만 쓴다.
  return job
    ? { title: job.title, description: `${job.title} — 부산·울산·경남·경북 강사 공고를 매일 모아 보여주는 강사잇다. 기관·마감일·지원 방법은 무료 회원가입 후 확인.` }
    : { title: "공고를 찾을 수 없습니다", robots: { index: false } };
}

export default async function JobDetailPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const { id } = await params;
  const today = todayInSeoul();

  // 회원이면 상세 전부, 비회원이면 제목만 꺼낸다.
  // 비회원에게는 화면에서 가리는 게 아니라 데이터베이스가 아예 내주지 않는다.
  const member = await getCurrentMember();
  const detail = member ? await getJobDetail(id) : null;
  const job = detail ?? (await getJobTitle(id));
  if (!job) notFound();

  const daysLeft = detail ? daysBetween(today, detail.deadline) : null;
  // 기관이 직접 올린 공고는 지원 방법이 다르다 (강사잇다에서 바로 지원). 강사·기관 회원에 따라 안내가 다르고, 이미 지원했으면 그 상태를 보여 준다.
  const [memberType, application] = detail?.fromRequest ? await Promise.all([getMemberType(), getMyApplication(detail.id)]) : [null, null];
  const justApplied = (await searchParams).applied === "1" && application !== null;

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

      {justApplied && (
        <p role="status" className="mt-4 rounded-card bg-ok/10 px-5 py-4 text-[15px] font-semibold text-ok">
          지원했어요. 기관이 검토한 뒤 고르면 운영자가 연락드릴게요.
        </p>
      )}

      <header className="mt-4">
        {detail && daysLeft !== null && (
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted">
              {detail.fromRequest && <FromRequestBadge />}
              <span className="truncate">{detail.organization}</span>
            </p>
            <DeadlineBadge daysLeft={daysLeft} />
          </div>
        )}
        <h1 className="text-[24px] leading-snug font-bold tracking-tight md:text-[30px]">{job.title}</h1>
      </header>

      {detail && daysLeft !== null ? (
        /* 휴대폰: 요약 → 본문 순서로 한 줄. PC: 왼쪽 본문, 오른쪽 요약(스크롤해도 따라옴). */
        <div className="mt-5 grid gap-4 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
          <aside className="rounded-card bg-white p-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
            <FactList
              facts={[
                { label: "지역", value: detail.region },
                { label: "마감", value: formatKoreanDate(detail.deadline) },
                { label: "수업 일정", value: detail.schedule },
                { label: "수업 대상", value: detail.target },
                { label: "모집 인원", value: detail.headcount ? `${detail.headcount}명` : undefined },
              ]}
            />
            <SourceLink url={detail.sourceUrl} />
            {daysLeft < 0 ? <ClosedNotice /> : detail.fromRequest ? <PostingApply jobId={detail.id} memberType={memberType} application={application} /> : <ApplyActions job={detail} />}
          </aside>

          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <TextSection title="상세 내용">
              <p className="whitespace-pre-line">{detail.description}</p>
            </TextSection>
            {detail.qualifications && (
              <TextSection title="지원 자격">
                <LineList text={detail.qualifications} />
              </TextSection>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 lg:mt-8">
          <MembersOnlyNotice next={`/jobs/${job.id}`} />
        </div>
      )}
    </article>
  );
}
