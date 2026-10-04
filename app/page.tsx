import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { URGENT_DAYS } from "@/components/job-card";
import { AD_INQUIRY_HREF, COURSES, type Course } from "@/lib/courses";
import { daysBetween, formatKoreanDate, formatKoreanTime, seoulDateOf, todayInSeoul } from "@/lib/date";
import {
  getLastJobUpdate,
  getOpenJobTitles,
  getOpenJobs,
  getTodayDeadlineCount,
  getTodayJobCount,
  type Job,
  type JobTitle,
} from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";

/** 홈 공고 표에 보여줄 개수 (마감 가까운 순) */
const HOME_JOB_COUNT = 7;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();

  // 공고 탭과 같은 규칙: 회원은 기관·지역·마감일까지, 비회원은 제목만 받는다.
  const member = await getCurrentMember();
  const [openJobs, todayDeadlineCount, todayNewCount, lastUpdate] = await Promise.all([
    member ? getOpenJobs(today) : getOpenJobTitles(today),
    getTodayDeadlineCount(today),
    getTodayJobCount(today),
    getLastJobUpdate(),
  ]);
  // 교육과정 칸은 광고(과정)가 하나라도 들어왔을 때만 보인다. 없으면 맨 아래 한 줄 문의만.
  const hasCourses = COURSES.some((c) => c.name);
  const homeJobs = openJobs.slice(0, HOME_JOB_COUNT);
  // 회원 탈퇴를 마치고 홈으로 온 경우 (?deleted=1)
  const justDeleted = !member && (await searchParams).deleted === "1";

  return (
    // data-home: 홈에서만 바탕을 흰색으로 바꾼다 (app/globals.css)
    <div data-home className="flex flex-col">
      {justDeleted && (
        <p role="status" className="mb-6 rounded-card bg-bg px-5 py-4 text-[15px] text-ink">
          회원 탈퇴가 끝났어요. 회원 정보는 모두 지워졌어요. 그동안 이용해 주셔서 감사합니다.
        </p>
      )}

      {/* ① 첫인사: 지원할 수 있는 공고 수 + 오늘 마감 */}
      <section className="flex flex-col gap-5 pt-2 md:grid md:grid-cols-12 md:items-end md:gap-6 md:pt-6">
        <div className="md:col-span-7">
          <h1 className="text-[30px] leading-[1.3] font-black tracking-tight md:text-[52px] md:leading-[1.2]">
            오늘 지원할 수 있는
            <br />
            강사 공고 <span className="nums text-brand">{openJobs.length}</span>건
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted md:mt-5 md:text-[18px]">
            부산·울산·경남 교육청, 구·군청, 시설공단, 대학 평생교육원 공고를
            <br className="hidden md:block" /> 매일 아침 직접 확인해서 올려요.
          </p>
          {lastUpdate && <UpdatedLine lastUpdate={lastUpdate} today={today} todayNewCount={todayNewCount} />}
          <div className="mt-8 hidden gap-3 md:flex">
            <ButtonLink href="/jobs" primary>
              전체 공고 보기
            </ButtonLink>
            {!member && <ButtonLink href="/signup">무료 회원가입</ButtonLink>}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-card bg-accent/10 px-5 py-4 md:col-span-5 md:rounded-[24px] md:p-8">
          <div className="flex flex-col gap-0.5 md:gap-1.5">
            <p className="text-[15px] font-bold text-warn md:text-[16px]">오늘 마감</p>
            <p className="text-[12px] text-muted md:text-[15px]">오늘 자정이 지나면 목록에서 사라져요</p>
          </div>
          <p className="nums shrink-0 text-[40px] leading-none font-black tracking-tight text-accent md:text-[64px]">
            {todayDeadlineCount}
            <span className="ml-1 text-[18px] md:text-[22px]">건</span>
          </p>
        </div>
      </section>

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

      {/* ③ 운영자 소개. 현장 사진이 생기면 함께 넣는다 */}
      <section className="mt-8 rounded-card bg-bg p-5 md:mt-12 md:p-8">
        <p className="text-[13px] font-semibold text-brand">강사잇다를 만든 사람들</p>
        <p className="mt-2 text-[17px] leading-relaxed font-medium text-ink md:max-w-[760px] md:text-[19px]">
          &ldquo;부산에서 학교 진로캠프를 운영하며 좋은 강사님을 찾는 게 늘 가장 어려웠어요. 그래서 공고는 강사님께, 강사님은 학교에 더 쉽게
          닿도록 매일 직접 정리하고 있습니다.&rdquo;
        </p>
        <p className="mt-3 text-[14px] text-muted">한국엑스퍼트교육원 대표 박서현</p>
        <p className="nums mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink">
          <span><b>500명</b> 강사풀</span>
          <span><b>1,000명+</b> 전국 강사방</span>
          <span><b>부울경</b> 학교·기관 공고 매일</span>
        </p>
      </section>

      {/* ④ 교육과정: 광고(과정)가 하나라도 들어왔을 때만 */}
      {hasCourses && (
      <section aria-labelledby="courses-title" className="mt-8 md:mt-12">
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
      )}

      {/* ⑤ 공고 표 (마감 가까운 순) */}
      <section aria-label="마감이 가까운 공고" className="mt-9 md:mt-16">
        <JobTableHead isMember={member !== null} />
        {homeJobs.length === 0 ? (
          <p className="border-b border-line py-8 text-center text-sm text-muted">지금은 지원할 수 있는 공고가 없습니다.</p>
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
            href="/jobs"
            className="nums flex h-[52px] items-center rounded-badge bg-bg px-7 text-[16px] font-bold transition-colors hover:bg-line"
          >
            공고 {openJobs.length}건 모두 보기 →
          </Link>
        </div>
        <div className="mt-5 flex flex-col gap-2 md:hidden">
          <ButtonLink href="/jobs" primary>
            <span className="nums">공고 {openJobs.length}건 모두 보기</span>
          </ButtonLink>
          {!member && <ButtonLink href="/signup">무료 회원가입</ButtonLink>}
        </div>
      </section>
      {!hasCourses && (
        <p className="mt-10 text-center text-[13px] text-muted">
          교육 과정을 강사님들께 소개하고 싶으신가요?{" "}
          <a href={AD_INQUIRY_HREF} className="font-semibold text-ink underline underline-offset-2">
            교육 광고 문의
          </a>
        </p>
      )}
    </div>
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

/** "오늘 오전 9:12 업데이트 · 새 공고 12건" — 마지막으로 공고를 올린 시각. 오늘이 아니면 날짜로 */
function UpdatedLine({ lastUpdate, today, todayNewCount }: { lastUpdate: string; today: string; todayNewCount: number }) {
  const day = seoulDateOf(lastUpdate);
  const when = day === today ? `오늘 ${formatKoreanTime(lastUpdate)}` : formatKoreanDate(day);
  return (
    <p className="nums mt-3 flex items-center gap-2 text-[13px] text-muted md:text-[14px]">
      <span className={`h-2 w-2 rounded-full ${day === today ? "bg-ok" : "bg-line"}`} aria-hidden="true" />
      {when} 업데이트
      {todayNewCount > 0 && <> · 새 공고 {todayNewCount}건</>}
    </p>
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
  accent: "bg-accent/10 text-accent",
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
  const base = "border-b-2 border-ink pb-2.5 text-[13px] font-bold text-[#4E5968] md:py-3.5 md:text-[14px]";

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
