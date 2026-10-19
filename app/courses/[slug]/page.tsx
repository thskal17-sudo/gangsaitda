import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { type CourseDetail, courseBySlug } from "@/lib/courses";
import { todayInSeoul } from "@/lib/date";

/*
 * 교육 소개 화면 (/courses/주소이름). 홈 '강사 경력에 더하는 교육과정' 카드를 누르면 온다.
 * 내용은 lib/courses.ts 의 detail 에서 정한다. 보고서처럼 노란 띠·표(Exhibit) 모양.
 * 신청 마감일(until)이 지나면 화면은 그대로 두고 '지난 교육' 안내를 띄우며 신청 버튼을 뺀다.
 */

/** 노란 띠·강조 칸 색 (이 화면에서만 씀) */
const YELLOW = "bg-[#FFE500]";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = courseBySlug(slug, todayInSeoul());
  if (!course?.detail) return { title: "교육" };
  return { title: `${course.detail.series} · ${course.name}`, description: course.detail.lead };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  await connection();
  const { slug } = await params;
  const course = courseBySlug(slug, todayInSeoul());
  if (!course?.detail) notFound();
  const d = course.detail;
  const ended = Boolean(course.ended);

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">
        ← 홈
      </Link>

      {/* 첫 칸: 노란 띠 + 큰 제목 */}
      <section className="overflow-hidden rounded-card bg-white">
        <div className={`${YELLOW} flex items-center justify-between px-5 py-4 md:px-8`}>
          <span className="text-[15px] font-bold text-ink md:text-[17px]">{d.series}</span>
          <span className="text-[15px] font-black tracking-tight text-ink md:text-[17px]">강사잇다</span>
        </div>
        <div className="px-5 pt-6 pb-7 md:px-8 md:pt-9 md:pb-10">
          {ended && (
            <p role="status" className="mb-5 rounded-control bg-bg px-4 py-3 text-[15px] font-semibold text-muted">
              지난 교육이에요. {d.dateLabel}에 진행했어요.
            </p>
          )}
          <h1 className="text-[30px] leading-[1.3] font-black tracking-tight text-ink md:text-[44px] md:leading-[1.25]">
            <Highlight text={d.headline} />
          </h1>
          <p className="mt-3 text-[16px] font-semibold text-ink md:text-[18px]">{d.lead}</p>
          <div className={`mt-5 h-1 w-16 ${YELLOW}`} aria-hidden="true" />
        </div>
      </section>

      {/* Exhibit 1. 이런 분께 */}
      <section aria-labelledby="for-whom" className="rounded-card bg-white p-5 md:p-8">
        <ExhibitLabel id="for-whom" n={1} title="이런 분께 딱 맞아요" />
        <ol className="divide-y divide-line">
          {d.forWhom.map((line, i) => (
            <li key={line} className="flex gap-4 py-3.5 text-[15px] leading-relaxed text-ink md:text-[16px]">
              <span className="nums w-5 shrink-0 font-bold">{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Exhibit 2. 커리큘럼 */}
      <section aria-labelledby="curriculum-title" className="rounded-card bg-white p-5 md:p-8">
        <h2 id="curriculum-title" className="text-[24px] leading-snug font-black tracking-tight text-ink md:text-[32px]">
          {d.curriculumTitle}
        </h2>
        <div className={`mt-3 mb-5 h-1 w-full ${YELLOW}`} aria-hidden="true" />
        <ExhibitLabel id="curriculum-table" n={2} title={`${d.series} 커리큘럼`} />
        <ol>
          {d.curriculum.map((step, i) => {
            const last = i === d.curriculum.length - 1;
            return (
              <li
                key={step.title}
                className={`flex gap-4 px-3 py-4 md:gap-8 md:px-4 ${last ? `${YELLOW} border-b-2 border-ink` : "border-b border-line"}`}
              >
                <span className="nums w-14 shrink-0 pt-0.5 text-[13px] font-black text-ink md:w-16 md:text-[14px]">STEP {i + 1}</span>
                <div>
                  <p className="text-[17px] font-bold text-ink md:text-[19px]">{step.title}</p>
                  {step.lines.map((line) => (
                    <p key={line} className="mt-1 text-[14px] leading-relaxed text-ink/75 md:text-[15px]">
                      {line}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
        {d.curriculumNote && <p className="mt-3 text-[13px] text-muted">{d.curriculumNote}</p>}
      </section>

      {/* 일시·신청 */}
      <section aria-labelledby="schedule" className="rounded-card bg-white p-5 md:p-8">
        <h2 id="schedule" className="text-[13px] font-bold text-muted">
          일시 · 신청
        </h2>
        <div className="mt-3 overflow-hidden rounded-control border-2 border-ink">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-ink px-4 py-3">
            <span className="text-[19px] font-black text-[#FFE500] md:text-[21px]">{d.dateLabel}</span>
            <span className="text-[13px] font-semibold text-white">{d.sessionNote}</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line">
            {d.sessions.map((s) => (
              <div key={s.label} className="px-4 py-4">
                <p className="text-[13px] text-muted">{s.label}</p>
                <p className="nums mt-1 text-[19px] font-bold text-ink md:text-[22px]">{s.time}</p>
              </div>
            ))}
          </div>
          <dl className="border-t border-line px-4 py-3 text-[14px] text-ink">
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-muted">참가비</dt>
              <dd className="nums font-semibold">{d.fee}</dd>
            </div>
            {d.capacity && (
              <div className="mt-1.5 flex gap-2">
                <dt className="w-14 shrink-0 text-muted">정원</dt>
                <dd className="nums font-semibold">{d.capacity}</dd>
              </div>
            )}
            <div className="mt-1.5 flex gap-2">
              <dt className="w-14 shrink-0 text-muted">신청</dt>
              <dd className="font-semibold">{d.applyVia}</dd>
            </div>
          </dl>
        </div>
        {d.perk && (
          <p className={`mt-3 rounded-control px-4 py-3 text-[15px] font-bold text-ink ${YELLOW}`}>🎁 {d.perk}</p>
        )}

        <div className="mt-5">
          {ended || !course.href ? (
            <p className="flex h-14 items-center justify-center rounded-control bg-bg text-[16px] font-semibold text-muted">
              신청이 끝난 교육이에요
            </p>
          ) : (
            <>
              <a
                href={course.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90"
              >
                {d.applyVia}으로 신청하기
              </a>
              <p className="mt-2 text-center text-[13px] text-muted">신청서는 새 창에서 열려요.</p>
            </>
          )}
        </div>
        {d.moreInfo && <p className="mt-4 text-center text-[13px] text-muted">{d.moreInfo}</p>}
      </section>
    </article>
  );
}

/** 보고서 표 이름표: 위쪽 굵은 선 + 회색 띠 "Exhibit N. 제목" */
function ExhibitLabel({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h2 id={id} className="border-t-2 border-ink bg-bg px-3 py-2.5 text-[14px] font-bold text-ink md:px-4 md:text-[15px]">
      Exhibit {n}. <span className="ml-1">{title}</span>
    </h2>
  );
}

/** "…[시작]…" 의 대괄호 부분만 주황 글씨로 */
function Highlight({ text }: { text: CourseDetail["headline"] }) {
  return text.split(/(\[[^\]]+\])/).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span key={i} className="text-accent">
        &lsquo;{part.slice(1, -1)}&rsquo;
      </span>
    ) : (
      part
    ),
  );
}
