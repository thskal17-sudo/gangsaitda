import type { Metadata } from "next";
import { connection } from "next/server";
import JobCard from "@/components/job-card";
import { todayInSeoul } from "@/lib/date";
import { getOpenJobTitles, getOpenJobs } from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";

export const metadata: Metadata = { title: "공고" };

export default async function JobsPage() {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();

  // 회원은 기관·지역·마감일까지, 비회원은 제목만 받는다.
  const member = await getCurrentMember();
  const jobs = member ? await getOpenJobs(today) : await getOpenJobTitles(today);

  return (
    <section>
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">공고</h1>
      <p className="mt-1 text-sm text-muted">
        지원할 수 있는 공고 <span className="nums font-semibold text-ink">{jobs.length}</span>건
      </p>

      {jobs.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-5 text-sm text-muted">
          지금은 지원할 수 있는 공고가 없습니다.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:mt-6 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
