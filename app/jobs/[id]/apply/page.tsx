import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import MemberTypeNotice from "@/components/member-type-notice";
import { getMyApplication } from "@/lib/apply";
import { daysBetween, formatKoreanDate, seoulDateOf, todayInSeoul } from "@/lib/date";
import { getJobDetail } from "@/lib/jobs";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { getMyProfile } from "@/lib/profile";
import ApplyForm from "./apply-form";

export const metadata: Metadata = { title: "공고 지원하기", robots: { index: false, follow: false } };

/**
 * 강사 회원 · '강사잇다 모집' 공고에 지원하기. 기관이 올리고 운영자가 승인한 공고만 (jobs.request_id 가 있는 공고).
 * 이미 지원했거나 마감된 공고는 공고 화면으로 돌려보낸다.
 */
export default async function ApplyPage({ params }: PageProps<"/jobs/[id]/apply">) {
  await connection();
  const { id } = await params;
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(`/jobs/${id}/apply`)}`);
  if ((await getMemberType()) === "기관") {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <MemberTypeNotice need="강사" />
      </section>
    );
  }

  const job = await getJobDetail(id);
  if (!job) notFound();
  if (!job.fromRequest) redirect(`/jobs/${job.id}`);
  const today = todayInSeoul();
  const [application, profile] = await Promise.all([getMyApplication(job.id), getMyProfile(member.id)]);
  if (application || daysBetween(today, job.deadline) < 0) redirect(`/jobs/${job.id}`);

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-muted hover:text-ink">
        ← 공고로
      </Link>
      <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">공고 지원하기</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        <b className="text-ink">{job.title}</b>
        <br />
        {job.organization} · {job.region} · <span className="nums">{formatKoreanDate(job.deadline)}</span> 마감
      </p>

      <div className="mt-5">
        <ApplyForm
          jobId={job.id}
          profile={
            profile
              ? { savedDate: formatKoreanDate(seoulDateOf(profile.updatedAt)), method: profile.method, fileName: profile.fileName ?? undefined }
              : null
          }
        />
      </div>
    </section>
  );
}
