import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import MemberTypeNotice from "@/components/member-type-notice";
import { formatKoreanDate } from "@/lib/date";
import { MATCH_STATUS_STYLE, type MatchStatus } from "@/lib/match-status";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { type MyMatch, getMyMatches, isFinished } from "@/lib/my-matches";
import { getMyProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "내 지원 현황", robots: { index: false, follow: false } };

/**
 * 강사 회원 · 내 지원 현황. 공고에 직접 지원한 것과 운영자가 기관에 추천한 것을 한곳에서,
 * 진행 중 / 결과가 나온 것으로 나눠 보여 준다. 데이터는 lib/my-matches.ts.
 */
export default async function MyApplicationsPage() {
  await connection();
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

  const [matches, profile] = await Promise.all([getMyMatches(), getMyProfile(member.id)]);
  const ongoing = matches?.filter((m) => !isFinished(m)) ?? [];
  const finished = matches?.filter(isFinished) ?? [];

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">내 지원 현황</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        공고에 지원하셨거나, 운영자가 기관에 강사님을 추천해 드린 내역이에요. 섭외가 확정되면 운영자가 연락드려요.
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
    </section>
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
        {m.updatedDate !== m.startedDate && (
          <span className="nums ml-1 text-muted">({formatKoreanDate(m.updatedDate)} 바뀜)</span>
        )}
      </p>
      {m.applied && m.jobId && (
        <Link href={`/jobs/${m.jobId}`} className="mt-3 inline-block text-[14px] font-semibold text-brand hover:underline">
          공고 보기 →
        </Link>
      )}
    </article>
  );
}
