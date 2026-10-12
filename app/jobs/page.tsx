import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import JobCard from "@/components/job-card";
import JobSearch from "@/components/job-search";
import RegionTabs from "@/components/region-tabs";
import { todayInSeoul } from "@/lib/date";
import { matchesQuery, parseQueryParam, queryWords } from "@/lib/job-search";
import { type Job, type JobTitle, getOpenJobTitles, getOpenJobs, getTodayJobTitles } from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";
import { countByRegion, parseRegionParam, regionGroupOfJob } from "@/lib/regions";

export const metadata: Metadata = { title: "공고" };

/**
 * 공고 목록. 주소 끝에 ?view=today 가 붙으면 '오늘 올라온 공고'만 보여준다 (홈에서 들어옴).
 * ?region=부산 이 붙으면 그 권역만 보여준다 (지역 탭, lib/regions.ts).
 * ?q=검색어 가 붙으면 그 말이 들어간 공고만 보여준다 (검색칸, lib/job-search.ts).
 */
export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();
  const params = await searchParams;
  const onlyToday = params.view === "today";
  const region = parseRegionParam(params.region);
  const query = parseQueryParam(params.q);

  // 회원은 기관·지역·마감일까지, 비회원은 제목만 받는다.
  const member = await getCurrentMember();
  let jobs: (Job | JobTitle)[] = member ? await getOpenJobs(today) : await getOpenJobTitles(today);

  if (onlyToday) {
    const todayIds = new Set((await getTodayJobTitles(today)).map((job) => job.id));
    jobs = jobs.filter((job) => todayIds.has(job.id));
  }
  // 검색: 먼저 검색어로 줄이고, 지역 탭 숫자는 그 결과 기준으로 센다
  const words = queryWords(query);
  if (words.length > 0) jobs = jobs.filter((job) => matchesQuery(job, words));
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
          {query ? (
            <>
              <span className="font-semibold text-ink">&lsquo;{query}&rsquo;</span> 검색 결과{region ? ` (${region})` : ""}{" "}
            </>
          ) : (
            <>
              {region ? `${region} ` : ""}
              {onlyToday ? "오늘 올라온 공고" : "지원가능한 공고"}{" "}
            </>
          )}
          <span className="nums font-semibold text-ink">{jobs.length}</span>건
        </p>
        {onlyToday && (
          <Link href="/jobs" className="text-sm font-semibold text-brand hover:underline">
            전체 공고 보기
          </Link>
        )}
      </div>

      {/* 검색어·오늘 보기·지역은 서로 남긴다: 검색해도 지역 탭이 유지되고, 탭을 눌러도 검색어가 유지된다 */}
      <div className="mt-4 md:mt-6">
        <JobSearch query={query} basePath="/jobs" keepParams={{ ...(onlyToday ? { view: "today" } : {}), ...(region ? { region } : {}) }} />
      </div>
      <div className="mt-3 md:mt-4">
        <RegionTabs active={region} counts={counts} total={total} basePath="/jobs" keepParams={{ ...(onlyToday ? { view: "today" } : {}), ...(query ? { q: query } : {}) }} />
      </div>

      {jobs.length === 0 ? (
        <p className="mt-4 rounded-card bg-white p-5 text-sm text-muted">
          {query
            ? `'${query}' 에 맞는 공고가 없습니다. 다른 말로 찾아보거나 '지우기'를 눌러 전체 공고를 보세요.`
            : onlyToday
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
