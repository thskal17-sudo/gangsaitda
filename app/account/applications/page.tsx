import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DeadlineBadge } from "@/components/job-card";
import MemberTypeNotice from "@/components/member-type-notice";
import SavedJobActions from "@/components/saved-job-actions";
import { daysBetween, formatKoreanDate, todayInSeoul } from "@/lib/date";
import { MATCH_STATUS_STYLE, type MatchStatus } from "@/lib/match-status";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { type MyMatch, getMyMatches, isFinished } from "@/lib/my-matches";
import { getMyProfile } from "@/lib/profile";
import { type SavedJob, getMySavedJobs } from "@/lib/saved-jobs";

export const metadata: Metadata = { title: "내 지원 현황", robots: { index: false, follow: false } };

/**
 * 강사 회원 · 내 지원 현황. 탭 두 개:
 * - 관심 공고 (?tab=saved, 기본): 공고 목록·상세에서 별로 담은 공고. [지원했어요]로 사이트 밖 지원도 기록 (lib/saved-jobs.ts)
 * - 지원·추천 (?tab=progress): 강사잇다 모집 공고에 직접 지원한 것과 운영자 추천, 진행 중 / 결과 (lib/my-matches.ts)
 */
export default async function MyApplicationsPage({ searchParams }: PageProps<"/account/applications">) {
  await connection();
  const tab = (await searchParams).tab === "progress" ? "progress" : "saved";
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/account/applications");
  if ((await getMemberType()) === "기관") {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">내 지원 현황</h1>
        <div className="mt-5">
          <MemberTypeNotice need="강사" />
        </div>
      </section>
    );
  }

  const today = todayInSeoul();
  const [savedJobs, matches, profile] = await Promise.all([getMySavedJobs(today), getMyMatches(), getMyProfile(member.id)]);
  const ongoing = matches?.filter((m) => !isFinished(m)) ?? [];
  const finished = matches?.filter(isFinished) ?? [];

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">내 지원 현황</h1>

      <nav aria-label="내 지원 현황 보기" className="mt-4 grid grid-cols-2 gap-1 rounded-control bg-white p-1">
        <TabLink href="/account/applications" active={tab === "saved"} label="관심 공고" count={savedJobs?.length} />
        <TabLink href="/account/applications?tab=progress" active={tab === "progress"} label="지원·추천" count={matches?.length} />
      </nav>

      {tab === "saved" ? (
        <SavedTab jobs={savedJobs} today={today} />
      ) : (
        <>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            강사잇다 모집 공고에 지원하셨거나, 운영자가 기관에 강사님을 추천해 드린 내역이에요. 섭외가 확정되면 운영자가 연락드려요.
          </p>

          {!profile && (
            <Link href="/account/profile" className="mt-5 block rounded-card bg-brand/5 p-5 transition-transform active:scale-[0.99]">
              <p className="text-[15px] font-bold text-brand">프로필을 등록하면 추천받을 수 있어요 →</p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">기관에서 강사섭외 의뢰가 오면 운영자가 맞는 강사님 프로필을 골라 전달해요.</p>
            </Link>
          )}

          {matches === null ? (
            <div className="mt-5 rounded-card bg-white p-6 text-center">
              <p className="text-[15px] text-muted">지원 현황을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="mt-5 rounded-card bg-white p-6 text-center">
              <p className="text-[15px] text-muted">아직 지원하거나 추천받은 내역이 없어요.</p>
              <Link
                href="/jobs"
                className="mx-auto mt-4 flex h-14 max-w-xs items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white hover:bg-brand/90"
              >
                공고 보러 가기
              </Link>
            </div>
          ) : (
            <>
              <MatchGroup title="진행 중" matches={ongoing} empty="지금 진행 중인 지원·추천은 없어요." />
              <MatchGroup title="결과가 나온 것" matches={finished} empty="아직 결과가 나온 것은 없어요." />
            </>
          )}
        </>
      )}
    </section>
  );
}

function TabLink({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] text-[15px] transition-colors ${
        active ? "bg-brand font-bold text-white" : "font-semibold text-muted hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && <span className="nums">{count}</span>}
    </Link>
  );
}

/** 관심 공고 탭: 마감 전 공고는 마감 가까운 순, 마감이 지난 공고는 흐리게 아래에 */
function SavedTab({ jobs, today }: { jobs: SavedJob[] | null; today: string }) {
  if (jobs === null) {
    return (
      <div className="mt-5 rounded-card bg-white p-6 text-center">
        <p className="text-[15px] text-muted">관심 공고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
      </div>
    );
  }
  return (
    <>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        공고에서 <b className="text-ink">☆</b>를 눌러 담은 공고예요. 원문을 보고 지원하셨다면 <b className="text-ink">[지원했어요]</b>를 눌러 기록해 두세요.
        기록은 강사님만 볼 수 있어요.
      </p>
      {jobs.length === 0 ? (
        <div className="mt-5 rounded-card bg-white p-6 text-center">
          <p className="text-[15px] text-muted">아직 담은 공고가 없어요.</p>
          <Link
            href="/jobs"
            className="mx-auto mt-4 flex h-14 max-w-xs items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white hover:bg-brand/90"
          >
            공고 보러 가기
          </Link>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {jobs.map((j) => {
            const daysLeft = daysBetween(today, j.deadline);
            return (
              <li key={j.jobId}>
                <article className={`rounded-card bg-white p-5 md:p-6 ${daysLeft < 0 && !j.appliedDate ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] font-medium text-muted">{j.organization}</p>
                    <DeadlineBadge daysLeft={daysLeft} />
                  </div>
                  <Link href={`/jobs/${j.jobId}`} className="mt-1.5 block text-[17px] leading-snug font-bold tracking-tight text-ink hover:text-brand">
                    {j.title}
                  </Link>
                  <p className="nums mt-1 text-[13px] text-muted">
                    {j.region} · {formatKoreanDate(j.deadline)} 마감
                  </p>
                  {j.appliedDate && (
                    <p className="nums mt-3 rounded-control bg-ok/10 px-4 py-2.5 text-[14px] font-semibold text-ok">
                      ✓ {formatKoreanDate(j.appliedDate)}에 지원했어요
                    </p>
                  )}
                  <SavedJobActions jobId={j.jobId} applied={!!j.appliedDate} />
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function MatchGroup({ title, matches, empty }: { title: string; matches: MyMatch[]; empty: string }) {
  return (
    <div className="mt-8">
      <h2 className="text-[18px] font-bold tracking-tight text-ink">
        {title} <span className="nums text-brand">{matches.length}</span>
      </h2>
      {matches.length === 0 ? (
        <p className="mt-3 rounded-card bg-white p-5 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {matches.map((m) => (
            <li key={m.id}>
              <MatchCard match={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 강사에게 보여 줄 상태 이름과 설명 */
function statusText(m: MyMatch): { label: string; description: string } {
  const texts: Record<MatchStatus, { label: string; description: string }> = {
    지원: { label: "지원 완료", description: "기관이 지원 내용을 살펴볼 거예요." },
    추천: { label: "추천됨", description: "운영자가 기관에 강사님 프로필을 전달했어요." },
    "검토 중": { label: "기관 검토 중", description: "기관이 강사님 프로필을 보고 있어요." },
    "연락 중": { label: "일정 조율 중", description: "운영자가 기관과 일정을 맞추고 있어요. 곧 연락드려요." },
    확정: {
      label: "섭외 확정",
      description: m.requestDone ? "강의가 끝난 의뢰예요. 함께해 주셔서 고마워요." : "섭외가 확정됐어요. 운영자가 연락드려요.",
    },
    불발: { label: "이번엔 함께하지 못해요", description: "이번에는 함께하기 어렵게 됐어요. 다음 의뢰 때 다시 연결해 드릴게요." },
  };
  return texts[m.status];
}

function MatchCard({ match: m }: { match: MyMatch }) {
  const { label, description } = statusText(m);
  const title = m.applied ? (m.jobTitle ?? m.subject) : m.subject;
  const where = [m.orgName ?? m.orgType, m.region].filter(Boolean).join(" · ");

  return (
    <article className={`rounded-card bg-white p-5 md:p-6 ${m.status === "불발" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${MATCH_STATUS_STYLE[m.status]}`}>{label}</span>
        <span className="rounded-badge bg-bg px-2.5 py-0.5 text-[12px] font-semibold text-muted">{m.applied ? "직접 지원" : "운영자 추천"}</span>
        <span className="nums text-[13px] text-muted">
          {formatKoreanDate(m.startedDate)} {m.applied ? "지원" : "추천"}
        </span>
      </div>
      <p className="mt-2 text-[18px] font-bold leading-snug tracking-tight text-ink">{title}</p>
      <p className="mt-0.5 text-[14px] text-muted">{where}</p>
      <p className="mt-0.5 line-clamp-2 text-[14px] text-muted">일정 · {m.schedule}</p>
      <p className="mt-3 rounded-control bg-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
        {description}
        {m.updatedDate !== m.startedDate && <span className="nums ml-1 text-muted">({formatKoreanDate(m.updatedDate)} 바뀜)</span>}
      </p>
      {m.applied && m.jobId && (
        <Link href={`/jobs/${m.jobId}`} className="mt-3 inline-block text-[14px] font-semibold text-brand hover:underline">
          공고 보기 →
        </Link>
      )}
    </article>
  );
}
