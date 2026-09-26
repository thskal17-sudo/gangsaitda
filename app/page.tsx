import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import JobCard from "@/components/job-card";
import { todayInSeoul } from "@/lib/date";
import { getOpenJobTitles, getOpenJobs, getTodayJobCount } from "@/lib/jobs";
import { getCurrentMember } from "@/lib/member";

/** 홈에 보여줄 '마감이 가까운 공고' 개수 */
const DEADLINE_SOON_COUNT = 5;

export default async function HomePage() {
  // 오늘 날짜와 로그인 상태에 따라 달라지므로, 열 때마다 새로 그린다.
  await connection();
  const today = todayInSeoul();

  // 공고 탭과 같은 규칙: 회원은 기관·마감일까지, 비회원은 제목만 받는다.
  const member = await getCurrentMember();
  const [openJobs, todayCount] = await Promise.all([
    member ? getOpenJobs(today) : getOpenJobTitles(today),
    getTodayJobCount(today),
  ]);
  const soonJobs = openJobs.slice(0, DEADLINE_SOON_COUNT);

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      {/* ① 첫인사 */}
      <section className="pt-2 md:pt-6">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[44px]">
          강사와 기관을 잇다
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted md:text-[18px]">
          부산·울산·경남 학교·기관의 강사 공고를
          <br />
          한곳에서 확인하세요.
        </p>
        <div className="mt-6 flex gap-2 md:max-w-md">
          <ButtonLink href="/jobs" primary>
            공고 보기
          </ButtonLink>
          {!member && <ButtonLink href="/signup">무료 회원가입</ButtonLink>}
        </div>
      </section>

      {/* ② 오늘 올라온 공고 수 + 마감이 가까운 공고 */}
      <section>
        {/* 누르면 오늘 올라온 공고만 모아 보여준다 */}
        <Link
          href="/jobs?view=today"
          className="group flex items-center justify-between rounded-card bg-white px-5 py-4 transition-transform duration-150 active:scale-[0.98]"
        >
          <p className="text-[15px] text-muted">
            오늘 올라온 공고{" "}
            <span className="nums text-[22px] font-extrabold tracking-tight text-brand">{todayCount}</span>
            <span className="font-semibold text-ink">건</span>
          </p>
          <span className="text-sm font-semibold text-muted transition-colors group-hover:text-brand">보기 →</span>
        </Link>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="text-[20px] font-bold tracking-tight md:text-[24px]">마감이 가까운 공고</h2>
          <Link href="/jobs" className="text-sm font-semibold text-muted transition-colors hover:text-ink">
            전체 보기 →
          </Link>
        </div>

        {soonJobs.length === 0 ? (
          <p className="mt-3 rounded-card bg-white p-5 text-sm text-muted">지금은 지원할 수 있는 공고가 없습니다.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {soonJobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} today={today} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ③ 바로가기 */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ShortcutCard href="/certificates" title="자격증 과정" description="한국엑스퍼트교육원 자격증 과정 알아보기" />
        <ShortcutCard href="/request" title="강사가 필요하신가요?" description="학교·기관 강사섭외 의뢰하기" />
      </section>
    </div>
  );
}

function ButtonLink({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex h-14 flex-1 items-center justify-center rounded-control text-[16px] font-semibold transition-colors ${
        primary ? "bg-brand text-white hover:bg-brand/90" : "bg-white text-ink hover:bg-line"
      }`}
    >
      {children}
    </Link>
  );
}

function ShortcutCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-card bg-white p-5 transition-transform duration-150 active:scale-[0.98]"
    >
      <div>
        <p className="text-[17px] font-bold tracking-tight text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <span aria-hidden="true" className="text-xl text-muted transition-colors group-hover:text-brand">
        →
      </span>
    </Link>
  );
}
