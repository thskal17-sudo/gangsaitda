import { connection } from "next/server";
import JobCard from "@/components/job-card";
import { todayInSeoul } from "@/lib/date";
import { getOpenJobs } from "@/lib/jobs";

export default async function JobsPage() {
  // 오늘 날짜로 D-day 를 세므로, 미리 만들어두지 않고 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();
  const jobs = await getOpenJobs(today);

  return (
    <section>
      <h1 className="text-[22px] font-bold leading-snug md:text-[28px]">공고</h1>
      <p className="mt-1 text-sm text-muted">
        지원할 수 있는 공고 <span className="nums font-semibold text-ink">{jobs.length}</span>건
      </p>
      {/* 샘플 데이터를 쓰는 동안만 둔다. Supabase 를 붙이면 지운다. */}
      <p className="mt-1 text-xs text-muted">※ 지금 보이는 공고는 화면 확인용 샘플입니다.</p>

      {jobs.length === 0 ? (
        <p className="mt-4 rounded-card border border-line bg-white p-5 text-sm text-muted">
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
