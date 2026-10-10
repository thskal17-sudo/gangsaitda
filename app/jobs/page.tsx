import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import JobCard from "@/components/job-card";
import RegionTabs from "@/components/region-tabs";
import { todayInSeoul } from "@/lib/date";
import { type Job, type JobTitle, getOpenJobTitles, getOpenJobs, getTodayJobTitles } from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";
import { countByRegion, parseRegionParam, regionGroupOfJob } from "@/lib/regions";

export const metadata: Metadata = { title: "공고" };

/**
 * 공고 목록. 주소 끝에 ?view=today 가 붙으면 '오늘 올라온 공고'만 보여준다 (홈에서 들어옴).
 * ?region=부산 이 붙으면 그 권역만 보여준다 (지역 탭, lib/regions.ts).
 */
export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();
  const params = await searchParams;
  const onlyToday = params.view === "today";
  const region = parseRegionParam(params.region);

  // 회원은 기관·지역·마감일까지, 비회원은 제목만 받는다.
  const member = await getCurrentMember();
  let jobs: (Job | JobTitle)[] = member ? await getOpenJobs(today) : await getOpenJobTitles(today);

  if (onlyToday) {
    const todayIds = new Set((await getTodayJobTitles(today)).map((job) => job.id));
    jobs = jobs.filter((job) => todayIds.has(job.id));
  }
  // 지역 탭: 숫자는 탭을 고르기 전 목록 기준, 보여주는 목록만 고른 권역으로 줄인다
  const counts = countByRegion(jobs);
  const total = jobs.length;
  if (region) jobs = jobs.filter((job) => regionGroupOfJob(job) === region);

  return (
    <section>
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">
        {onlyToday ? "오늘 올라온 공고" : "공고"}
      </h1>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {region ? `${region} ` : ""}
          {onlyToday ? "오늘 올라온 공고" : "지원가능한 공고"}{" "}
          <span className="nums font-semibold text-ink">{jobs.length}</span>건
        </p>
        {onlyToday && (
          <Link href="/jobs" className="text-sm font-semibold text-brand hover:underline">
            전체 공고 보기
          </Link>
        )}
      </div>

      <div className="mt-4 md:mt-6">
        <RegionTabs active={region} counts={counts} total={total} basePath="/jobs" keepParams={onlyToday ? { view: "today" } : {}} />
      </div>

      {jobs.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-5 text-sm text-muted">
          {onlyToday
            ? "오늘은 아직 새로 올라온 공고가 없습니다."
            : region
              ? `지금 ${region} 지역에는 지원할 수 있는 공고가 없습니다.`
              : "지금은 지원할 수 있는 공고가 없습니다."}
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
