import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { URGENT_DAYS } from "@/components/job-card";
import { AD_INQUIRY_HREF, COURSES, type Course } from "@/lib/courses";
import { daysBetween, formatKoreanDate, todayInSeoul } from "@/lib/date";
import { getOpenJobTitles, getOpenJobs, getTodayDeadlineCount, type Job, type JobTitle } from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";
import { countByRegion, parseRegionParam, regionGroupOfJob } from "@/lib/regions";
import { INSTRUCTOR_COUNT_LABEL } from "@/lib/site";
import RegionTabs from "@/components/region-tabs";

/** 홈 공고 표에 보여줄 개수 (마감 가까운 순) */
const HOME_JOB_COUNT = 7;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();

  // 공고 탭과 같은 규칙: 회원은 기관·지역·마감일까지, 비회원은 제목만 받는다.
  const member = await getCurrentMember();
  const [openJobs, todayDeadlineCount] = await Promise.all([
    member ? getOpenJobs(today) : getOpenJobTitles(today),
    getTodayDeadlineCount(today),
  ]);
  const params = await searchParams;
  // 지역 탭 (?region=부산): 표만 그 권역으로 줄인다. 위쪽 숫자(지원가능한 공고 N건)는 전체 기준.
  const region = parseRegionParam(params.region);
  const regionJobs = region ? openJobs.filter((job) => regionGroupOfJob(job) === region) : openJobs;
  const homeJobs = regionJobs.slice(0, HOME_JOB_COUNT);
  // 회원 탈퇴를 마치고 홈으로 온 경우 (?deleted=1)
  const justDeleted = !member && params.deleted === "1";

  return (
    // data-home: 홈에서만 바탕을 흰색으로 바꾼다 (app/globals.css)
    <div data-home className="flex flex-col">
      {justDeleted && (
        <p role="status" className="mb-6 rounded-card bg-bg px-5 py-4 text-[15px] text-ink">
          회원 탈퇴가 끝났어요. 회원 정보는 모두 지워졌어요. 그동안 이용해 주셔서 감사합니다.
        </p>
      )}

      {/* ① 첫인사: 휴대폰은 주황 첫 화면(HeroMobile), PC 는 그라데이션 바탕 + 오늘 마감 카드(HeroDesktop) */}
      <div className="md:hidden">
        <HeroMobile openCount={openJobs.length} todayDeadlineCount={todayDeadlineCount} isMember={member !== null} />
      </div>
      <HeroDesktop
        openCount={openJobs.length}
        todayDeadlineCount={todayDeadlineCount}
        isMember={member !== null}
        jobs={openJobs.slice(0, 3)}
        today={today}
      />

      {/* ② 바로가기: 비회원은 강사 가입, 회원은 내 프로필 + 강사섭외. PC 에서는 나란히 */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-2 md:gap-6">
        {member ? (
          <ShortcutBox
            href="/account/profile"
            title="섭외 받을 프로필을 내 보세요"
            description="기관 의뢰가 오면 운영자가 골라 전달해 드려요"
            highlight
          />
        ) : (
          <ShortcutBox
            href="/signup"
            title="강사로 활동하고 계신가요?"
            description="무료 가입하면 기관·마감일·지원 방법까지 볼 수 있어요"
            highlight
          />
        )}
        <ShortcutBox href="/request" title="강사가 필요하신가요?" description="학교·기관 강사섭외 의뢰하기" />
      </div>

      {/* ③ 교육과정. 소개할 과정이 아직 없으면 PC 에서는 한 줄로 접는다 (휴대폰은 옆으로 미는 광고 자리) */}
      {!COURSES.some((c) => c.name) && (
        <a
          href={AD_INQUIRY_HREF}
          className="mt-14 hidden items-center justify-between rounded-card border border-line px-7 py-5 text-[15px] transition-colors hover:border-brand md:flex"
        >
          <span>
            <span className="font-bold">강사 경력에 더하는 교육과정</span>
            <span className="ml-3 text-muted">과정을 소개할 기관을 찾습니다 — 교육 광고 모집</span>
          </span>
          <span className="font-bold text-brand">광고 문의하기 →</span>
        </a>
      )}
      <section
        aria-labelledby="courses-title"
        className={`mt-8 md:mt-12 ${COURSES.some((c) => c.name) ? "" : "md:hidden"}`}
      >
        <SectionHead id="courses-title" title="강사 경력에 더하는 교육과정" href="/certificates" />
        {/* 휴대폰: 옆으로 밀어 보는 한 줄 / PC: 3칸 */}
        <ul className="-mr-4 mt-3.5 flex snap-x gap-3 overflow-x-auto pr-4 pb-1 md:mr-0 md:mt-5 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:p-0">
          {COURSES.map((course, i) => (
            <li key={i} className="w-60 shrink-0 snap-start md:w-auto">
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      </section>

      {/* ④ 공고 표 (마감 가까운 순) */}
      <section aria-label="마감이 가까운 공고" className="mt-9 md:mt-16">
        <div className="mb-4 md:mb-6">
          <RegionTabs active={region} counts={countByRegion(openJobs)} total={openJobs.length} basePath="/" />
        </div>
        <JobTableHead isMember={member !== null} />
        {homeJobs.length === 0 ? (
          <p className="border-b border-line py-8 text-center text-sm text-muted">
            {region ? `지금 ${region} 지역에는 지원할 수 있는 공고가 없습니다.` : "지금은 지원할 수 있는 공고가 없습니다."}
          </p>
        ) : (
          <ul>
            {homeJobs.map((job) => (
              <li key={job.id}>
                <JobRow job={job} today={today} />
              </li>
            ))}
          </ul>
        )}

        {/* PC: 가운데 둥근 버튼 / 휴대폰: 꽉 찬 버튼 두 개 */}
        <div className="mt-7 hidden justify-center md:flex">
          <Link
            href={region ? `/jobs?region=${region}` : "/jobs"}
            className="nums flex h-[52px] items-center rounded-badge bg-bg px-7 text-[16px] font-bold transition-colors hover:bg-line"
          >
            {region ? `${region} ` : ""}공고 {regionJobs.length}건 모두 보기 →
          </Link>
        </div>
        <div className="mt-5 flex flex-col gap-2 md:hidden">
          <ButtonLink href={region ? `/jobs?region=${region}` : "/jobs"} primary>
            <span className="nums">
              {region ? `${region} ` : ""}공고 {regionJobs.length}건 모두 보기
            </span>
          </ButtonLink>
          {!member && <ButtonLink href="/signup">무료 회원가입</ButtonLink>}
        </div>
      </section>
    </div>
  );
}


type HeroProps = { openCount: number; todayDeadlineCount: number; isMember: boolean };

/** 휴대폰 첫 화면: 한 블록을 시그니처 주황으로 꽉 채운다. 흰 글씨·흰 카드. */
function HeroMobile({ openCount, todayDeadlineCount, isMember }: HeroProps) {
  return (
    <section className="-mx-4 -mt-5 bg-brand px-5 pt-8 pb-9 text-white md:mx-0 md:mt-0 md:rounded-[32px] md:px-12 md:pt-14 md:pb-14">
      <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:items-center md:gap-8">
        <div className="md:col-span-7">
          <p className="text-[13px] font-semibold tracking-wide text-white/80 md:text-[15px]">부산·울산·경남 강사 공고를 매일 아침 한곳에</p>
          <h1 className="mt-2 text-[32px] leading-[1.25] font-black tracking-tight md:mt-3 md:text-[56px] md:leading-[1.15]">
            오늘 지원가능한
            <br />
            강사공고 <span className="nums">{openCount}</span>건
          </h1>
          <p className="mt-5 inline-flex items-center gap-2 rounded-badge bg-white/18 py-2 pr-4 pl-3 text-[13px] font-semibold md:mt-7 md:text-[15px]">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-white" />
            <span className="nums font-black">{INSTRUCTOR_COUNT_LABEL}</span> 강사님들이 강사잇다와 함께 하고 있습니다.
          </p>
          <div className="mt-7 flex gap-3 md:mt-9">
            <Link href="/jobs" className="flex h-13 flex-1 items-center justify-center rounded-control bg-white px-6 text-[16px] font-bold text-brand transition-colors hover:bg-white/90 md:h-14 md:flex-none md:px-8 md:text-[17px]">
              전체 공고 보기
            </Link>
            {!isMember && (
              <Link href="/signup" className="flex h-13 flex-1 items-center justify-center rounded-control border border-white/60 px-6 text-[16px] font-bold text-white transition-colors hover:bg-white/10 md:h-14 md:flex-none md:px-8 md:text-[17px]">
                무료 회원가입
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-card bg-white px-5 py-4 text-ink md:col-span-5 md:rounded-[24px] md:p-8">
          <div className="flex flex-col gap-0.5 md:gap-1.5">
            <p className="text-[15px] font-bold text-accent md:text-[16px]">오늘 마감</p>
            <p className="text-[12px] text-muted md:text-[15px]">오늘 자정이 지나면 목록에서 사라져요</p>
          </div>
          <p className="nums shrink-0 text-[40px] leading-none font-black tracking-tight text-accent md:text-[64px]">
            {todayDeadlineCount}
            <span className="ml-1 text-[18px] md:text-[22px]">건</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/** PC 첫 화면: 연한 주황 그라데이션 바탕, 큰 제목, 오른쪽에 오늘 마감·마감 임박 공고 카드. */
function HeroDesktop({
  openCount,
  todayDeadlineCount,
  isMember,
  jobs,
  today,
}: HeroProps & { jobs: (Job | JobTitle)[]; today: string }) {
  return (
    <section className="relative hidden md:block md:pt-10 md:pb-12">
      {/* 화면 가로 끝까지 깔리는 바탕 */}
      <div
        aria-hidden="true"
        className="absolute inset-y-[-2.5rem] left-1/2 -z-10 w-screen -translate-x-1/2 bg-[linear-gradient(180deg,#FFF1EB_0%,#FFF8F5_55%,#FFFFFF_100%)]"
      />
      <div className="grid grid-cols-12 items-center gap-12">
        <div className="col-span-7">
          <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-brand">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
            부산·울산·경남 강사 공고 · 매일 아침 업데이트
          </p>
          <h1 className="mt-5 text-[64px] leading-[1.1] font-black tracking-[-0.03em]">
            오늘 지원가능한
            <br />
            강사공고 <span className="nums text-brand">{openCount}</span>건
          </h1>
          <p className="mt-6 max-w-[520px] text-[18px] leading-relaxed text-muted">
            교육청, 구·군청, 시설공단, 대학 평생교육원 공고를 매일 아침 직접 확인해서 올려요. 기관·마감일·지원 방법까지 한곳에서.
          </p>
          <div className="mt-9 flex items-center gap-3">
            <Link
              href="/jobs"
              className="flex h-14 items-center rounded-control bg-brand px-8 text-[17px] font-bold text-white shadow-[0_12px_30px_-12px_rgba(255,118,76,0.7)] transition-colors hover:bg-brand/90"
            >
              전체 공고 보기
            </Link>
            {!isMember && (
              <Link href="/signup" className="flex h-14 items-center rounded-control px-6 text-[17px] font-bold text-ink transition-colors hover:bg-white">
                무료 회원가입 →
              </Link>
            )}
          </div>
          <p className="mt-10 flex items-center gap-3 text-[15px] text-muted">
            <span className="flex -space-x-2" aria-hidden="true">
              {["#FFB49B", "#FF9A7A", "#FF764C", "#D9442A"].map((c) => (
                <span key={c} className="h-7 w-7 rounded-full border-2 border-white" style={{ background: c }} />
              ))}
            </span>
            <span>
              <span className="nums font-black text-ink">{INSTRUCTOR_COUNT_LABEL}</span> 강사님들이 강사잇다와 함께 하고 있습니다.
            </span>
          </p>
        </div>

        <div className="col-span-5">
          <div className="rounded-[24px] bg-white p-7 shadow-[0_30px_80px_-30px_rgba(25,31,40,0.25)] ring-1 ring-black/[0.04]">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[14px] font-bold text-accent">오늘 마감</p>
                <p className="mt-1 text-[13px] text-muted">자정이 지나면 목록에서 사라져요</p>
              </div>
              <p className="nums text-[56px] leading-none font-black tracking-tight text-accent">
                {todayDeadlineCount}
                <span className="ml-1 text-[20px]">건</span>
              </p>
            </div>
            <ul className="mt-6 divide-y divide-line border-t border-line">
              {jobs.map((job) => {
                const summary = "deadline" in job ? job : null;
                const d = summary ? daysBetween(today, summary.deadline) : null;
                return (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="group flex items-center gap-4 py-3.5">
                      <span
                        className={`nums shrink-0 rounded-badge px-2.5 py-1 text-[12px] font-bold ${
                          d === 0 ? "bg-accent/10 text-accent" : d !== null && d <= URGENT_DAYS ? "bg-brand/10 text-brand" : "bg-bg text-muted"
                        }`}
                      >
                        {d === null ? "마감 순" : d === 0 ? "오늘" : `D-${d}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold group-hover:text-brand">{job.title}</span>
                        {summary && <span className="block truncate text-[12px] text-muted">{summary.organization} · {summary.region}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/jobs" className="mt-4 block text-[14px] font-bold text-brand hover:underline">
              마감 가까운 순으로 모두 보기 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 홈 바로가기 상자. highlight 는 옅은 파란 바탕(강사 등록), 아니면 흰 바탕에 테두리(강사섭외). */
function ShortcutBox({
  href,
  title,
  description,
  highlight,
}: {
  href: string;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between gap-4 rounded-card px-5 py-[18px] transition-colors md:px-8 md:py-7 ${
        highlight ? "border border-transparent bg-brand/8 hover:border-brand" : "border border-line hover:border-brand"
      }`}
    >
      <div>
        <p className={`text-[16px] font-bold tracking-tight md:text-[20px] ${highlight ? "text-brand" : ""}`}>{title}</p>
        <p className="mt-0.5 text-[12px] text-muted md:mt-1.5 md:text-[15px]">{description}</p>
      </div>
      <Arrow />
    </Link>
  );
}

function SectionHead({ id, title, href }: { id: string; title: string; href: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 id={id} className="text-[20px] font-black tracking-tight md:text-[26px]">
        {title}
      </h2>
      <Link href={href} className="text-[13px] font-bold text-muted transition-colors hover:text-ink md:text-[15px]">
        전체 보기 →
      </Link>
    </div>
  );
}

/** 과정 이미지가 없을 때 쓰는 상자 색 */
const TONE_CLASS: Record<Course["tone"], string> = {
  brand: "bg-brand/10 text-brand",
  accent: "bg-bg text-[#4E5968]",
  ok: "bg-ok/10 text-ok",
};

function CourseCard({ course }: { course: Course }) {
  // 과정 이름이 없으면 광고 모집 자리: 누르면 운영 이메일로 광고 문의
  const isAdSlot = !course.name;
  const href = isAdSlot ? AD_INQUIRY_HREF : (course.href ?? "/certificates");

  return (
    <a href={href} className="group flex flex-col gap-2.5 md:gap-3.5">
      <div
        className={`relative flex h-[140px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[14px] md:h-[210px] md:rounded-[16px] ${TONE_CLASS[course.tone]}`}
      >
        {course.image ? (
          <Image
            src={course.image}
            alt=""
            fill
            sizes="(min-width: 768px) 340px, 240px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <>
            <MedalIcon />
            <span className="text-[12px] font-bold md:text-[13px]">{isAdSlot ? "이 자리에 과정을 소개하세요" : "과정 대표 이미지"}</span>
          </>
        )}
      </div>
      <p className="truncate text-[16px] leading-snug font-bold text-ink group-hover:text-brand md:text-[19px]">
        {isAdSlot ? "교육 광고 모집합니다" : course.name}
      </p>
      <p className="-mt-1.5 text-[12px] font-medium text-brand md:-mt-2 md:text-[14px]">
        {isAdSlot ? "광고 문의하기 →" : course.provider}
      </p>
    </a>
  );
}

/** 공고 표 머리줄. PC 회원은 칸 이름 네 개, 그 밖에는 '마감일 순' 한 줄. */
function JobTableHead({ isMember }: { isMember: boolean }) {
  const base = "border-b border-line pb-2.5 text-[13px] font-bold text-muted md:py-3.5 md:text-[13px]";

  if (!isMember) {
    return (
      <div className={`${base} flex items-center justify-between gap-3`}>
        <span>마감일 순</span>
        <span className="flex items-center gap-1.5 font-medium text-muted">
          <LockIcon />
          기관·지역·마감일은 회원만 볼 수 있어요
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={`${base} md:hidden`}>마감일 순</div>
      <div className={`${base} hidden gap-6 md:grid ${ROW_COLUMNS}`}>
        <span>남은 날</span>
        <span>공고</span>
        <span>지역</span>
        <span>마감일</span>
      </div>
    </>
  );
}

const ROW_COLUMNS = "md:grid-cols-[120px_minmax(0,1fr)_200px_180px]";

/** 남은 날 글자 색: 오늘 마감은 주황, 마감임박은 진하게, 그 뒤는 옅게 */
function dayClass(daysLeft: number): string {
  if (daysLeft === 0) return "text-accent";
  if (daysLeft <= URGENT_DAYS) return "text-ink";
  return "text-[#B0B8C1]";
}

function JobRow({ job, today }: { job: Job | JobTitle; today: string }) {
  const summary = "deadline" in job ? job : null;
  const rowClass = "group flex gap-4 border-b border-line py-[18px] md:gap-6 md:py-[22px]";

  // 비회원: 제목만
  if (!summary) {
    return (
      <Link href={`/jobs/${job.id}`} className={rowClass}>
        <span className="text-[16px] leading-snug font-bold group-hover:text-brand md:text-[18px]">{job.title}</span>
      </Link>
    );
  }

  const daysLeft = daysBetween(today, summary.deadline);
  const [month, day] = summary.deadline.slice(5).split("-").map(Number);

  return (
    <Link href={`/jobs/${job.id}`} className={`${rowClass} md:grid md:items-center ${ROW_COLUMNS}`}>
      <span
        className={`nums w-[52px] shrink-0 pt-px text-[20px] font-black tracking-tight md:w-auto md:pt-0 md:text-[28px] ${dayClass(daysLeft)}`}
      >
        {daysLeft === 0 ? "오늘" : `D-${daysLeft}`}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[16px] leading-snug font-bold group-hover:text-brand md:text-[18px]">{summary.title}</span>
        {/* 휴대폰은 기관·지역·마감일을 한 줄로, PC 는 기관만 (지역·마감일은 옆 칸) */}
        <span className="nums text-[12px] text-muted md:hidden">
          {summary.organization} · {summary.region} · {month}/{day}
        </span>
        <span className="hidden text-[14px] text-muted md:block">{summary.organization}</span>
      </div>
      <span className="hidden text-[15px] text-[#4E5968] md:block">{summary.region}</span>
      <span className="nums hidden text-[15px] text-[#4E5968] md:block">{formatKoreanDate(summary.deadline)}</span>
    </Link>
  );
}

function ButtonLink({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex h-14 items-center justify-center rounded-control px-8 text-[16px] font-bold transition-colors md:text-[17px] ${
        primary ? "bg-brand text-white hover:bg-brand/90" : "border border-[#D1D6DB] bg-white text-ink hover:bg-bg"
      }`}
    >
      {children}
    </Link>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="text-xl text-muted transition-colors group-hover:text-brand">
      →
    </span>
  );
}

function MedalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 md:h-10 md:w-10"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.5 8 22l4-2 4 2-1-7.5" />
    </svg>
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
