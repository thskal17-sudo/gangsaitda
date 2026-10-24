import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AddMatchButton, MatchStatusButtons, PlanUpload, RemoveMatchButton, VerifyButton } from "@/components/admin-match-buttons";
import PostingReview from "@/components/admin-posting-review";
import { FilterRow, ProfileRow, pick } from "@/components/admin-profile-row";
import RequestCard from "@/components/admin-request-card";
import RequestStatusButtons from "@/components/admin-request-status";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import NotFoundCard from "@/components/not-found-card";
import { checkAdmin } from "@/lib/admin";
import { getAllProfiles } from "@/lib/admin-profiles";
import { getMatches, getMemberNames, getPosting, getRequest } from "@/lib/admin-requests";
import { formatKoreanDate, todayInSeoul } from "@/lib/date";
import { MATCH_STATUS_STYLE } from "@/lib/match-status";
import { PROFILE_FIELDS, PROFILE_REGIONS } from "@/lib/profile-schema";

export const metadata: Metadata = { title: "추천 강사 관리", robots: { index: false, follow: false } };

/** 실패하고 돌아왔을 때(?failed=…) 띄울 안내 */
const FAILED: Record<string, string> = {
  verify: "기관 확인 표시를 바꾸지 못했어요.",
  add: "추천 강사를 붙이지 못했어요.",
  status: "진행 상태를 바꾸지 못했어요.",
  remove: "추천에서 빼지 못했어요.",
  plan: "강의계획서를 지우지 못했어요.",
  review: "모집 공고를 처리하지 못했어요.",
  note: "반려 사유를 적어 주세요.",
  unverified: "기관 확인을 먼저 해야 승인할 수 있어요.",
};

/** 모집 공고를 처리하고 돌아왔을 때(?done=…) 띄울 안내 */
const DONE: Record<string, string> = {
  approved: "공고를 승인해 공고 목록에 올렸어요.",
  rejected: "공고를 반려했어요. 담당자가 고쳐서 다시 낼 수 있어요.",
};

/**
 * 관리자 · 강사섭외 의뢰 하나의 추천 강사 관리.
 *   ① 기관 확인: 대표번호로 전화하거나 기관 업무 메일인지 보고 '기관 확인됨'으로 표시
 *   ② 모집 공고 (담당자가 썼을 때만): 내용을 보고 승인(공고 목록에 게시) 또는 반려(사유)
 *   ③ 추천 강사: 붙인 강사마다 진행 상태(추천 · 검토 중 · 연락 중 · 확정 · 불발)를 바꾸거나 빼고, 강의계획서를 올린다.
 *      담당자가 '이 강사님으로 할게요'를 누른 강사에는 '기관 선택' 표시가 붙는다.
 *   ④ 강사 고르기: 분야·지역으로 걸러 '추천하기'
 * 의뢰를 낸 담당자는 '내 의뢰'(/account/requests)에서 '기관 확인됨' 의뢰의 추천 강사를 본다 (연락처는 확정 뒤에만).
 */
export default async function AdminRequestMatchPage({ params, searchParams }: PageProps<"/admin/requests/[id]">) {
  await connection();
  const { id } = await params;
  if (!(await checkAdmin(`/admin/requests/${encodeURIComponent(id)}`))) return <NotAdminCard />;

  const request = await getRequest(id);
  if (!request) {
    return (
      <AdminShell active="requests">
        <NotFoundCard
          title="의뢰를 찾을 수 없어요"
          description="주소가 틀렸거나 지워진 의뢰예요."
          primary={{ href: "/admin/requests", label: "의뢰 목록으로" }}
        />
      </AdminShell>
    );
  }

  const sp = await searchParams;
  const field = pick(sp.field, PROFILE_FIELDS);
  const region = pick(sp.region, PROFILE_REGIONS);
  const failed = typeof sp.failed === "string" ? FAILED[sp.failed] : undefined;
  const done = typeof sp.done === "string" ? DONE[sp.done] : undefined;

  const [matches, profiles, posting] = await Promise.all([getMatches(request.id), getAllProfiles(), getPosting(request.id)]);
  const profileOf = new Map(profiles.map((p) => [p.memberId, p]));
  // 프로필 없이 직접 지원한 강사는 이름을 회원 표에서 가져온다
  const names = await getMemberNames(matches.filter((m) => m.applied && !profileOf.has(m.memberId)).map((m) => m.memberId));
  const matched = new Set(matches.map((m) => m.memberId));
  // 강사 고르기: 아직 추천하지 않은 강사만. 지역으로 거를 때 '전국구' 강사는 어느 지역에나 함께 나온다.
  const candidates = profiles.filter(
    (p) =>
      !matched.has(p.memberId) &&
      (!field || p.fields.includes(field)) &&
      (!region || p.regions.includes(region) || p.regions.includes("전국구")),
  );
  const basePath = `/admin/requests/${request.id}`;

  return (
    <AdminShell active="requests">
      <Link href="/admin/requests" className="text-sm font-semibold text-muted hover:text-ink">
        ← 강사섭외 의뢰
      </Link>
      <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">추천 강사 관리</h1>
      <p className="mt-1 text-sm text-muted">
        기관을 확인하고, 의뢰에 맞는 강사를 골라 추천해 주세요. <b className="text-ink">강사 연락처는 확정 뒤에만</b> 기관에 알려요.
      </p>

      {failed && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] font-semibold text-warn">
          {failed} 잠시 뒤에 다시 시도해 주세요.
        </p>
      )}
      {done && (
        <p role="status" className="mt-4 rounded-card bg-ok/10 px-5 py-4 text-[15px] font-semibold text-ok">
          {done}
          {sp.done === "approved" && typeof sp.job === "string" && /^\d+$/.test(sp.job) && (
            <Link href={`/jobs/${sp.job}`} className="ml-2 underline underline-offset-2">
              공고 보기 →
            </Link>
          )}
        </p>
      )}

      <ul className="mt-5">
        <RequestCard request={request} today={todayInSeoul()}>
          <div className="mt-4 md:max-w-[360px]">
            <RequestStatusButtons id={request.id} status={request.status} />
          </div>
        </RequestCard>
      </ul>

      {/* ① 기관 확인 */}
      <section aria-labelledby="verify-title" className="mt-4 rounded-card bg-white p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="verify-title" className="text-[17px] font-bold text-ink">
              ① 기관 확인{" "}
              <span className={`ml-1 align-middle text-[14px] font-semibold ${request.verifiedDate ? "text-ok" : "text-warn"}`}>
                {request.verifiedDate ? `확인됨 · ${formatKoreanDate(request.verifiedDate)}` : "확인 전"}
              </span>
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              학교알리미·기관 홈페이지의 대표번호로 전화해 담당자를 확인하거나, 기관 업무용 메일인지 보고 표시해 주세요.
              <br />
              확인 전에는 담당자 &lsquo;내 의뢰&rsquo; 화면에 추천 강사가 보이지 않아요.
            </p>
          </div>
          <VerifyButton requestId={request.id} verified={Boolean(request.verifiedDate)} />
        </div>
      </section>

      {/* ② 모집 공고 (담당자가 썼을 때만) */}
      {posting && (
        <section aria-labelledby="posting-title" className="mt-4 rounded-card bg-white p-5 md:p-6">
          <h2 id="posting-title" className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-ink">
            ② 모집 공고
            <span
              className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${
                posting.status === "검토 중"
                  ? "bg-accent text-white"
                  : posting.status === "반려"
                    ? "bg-warn/10 text-warn"
                    : posting.closed
                      ? "bg-bg text-muted"
                      : "bg-ok text-white"
              }`}
            >
              {posting.status === "검토 중" ? "검토 요청" : posting.status === "반려" ? "반려함" : posting.closed ? "기관이 마감함" : "게시 중"}
            </span>
          </h2>
          <p className="nums mt-1 text-[13px] text-muted">
            {formatKoreanDate(posting.submittedDate)} 냄{posting.reviewedDate && ` · ${formatKoreanDate(posting.reviewedDate)} 처리`}
          </p>

          <div className="mt-3 rounded-control bg-bg p-4 text-[14px] leading-relaxed text-ink">
            <p className="text-[16px] font-bold">{posting.title}</p>
            <p className="nums mt-1 text-muted">지원 마감 {formatKoreanDate(posting.deadline)} · 기관명·지역·일정·대상·인원은 의뢰서 내용이 함께 올라가요</p>
            <p className="mt-3 whitespace-pre-line">{posting.description}</p>
            {posting.qualifications && (
              <p className="mt-3 whitespace-pre-line">
                <b>지원 자격</b>
                <br />
                {posting.qualifications}
              </p>
            )}
            {posting.documents && (
              <p className="mt-3">
                <b>제출 서류</b> {posting.documents}
              </p>
            )}
          </div>

          {posting.status === "검토 중" && <PostingReview requestId={request.id} verified={Boolean(request.verifiedDate)} />}
          {posting.status === "반려" && (
            <p className="mt-3 rounded-control bg-warn/8 px-4 py-3 text-[14px] text-warn">
              <b>반려 사유:</b> {posting.reviewNote ?? "(없음)"} — 담당자가 고쳐서 다시 내면 &lsquo;검토 요청&rsquo;으로 바뀌어요.
            </p>
          )}
          {posting.status === "승인" && posting.jobId && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/jobs/${posting.jobId}`} className="flex h-10 items-center rounded-control bg-brand/10 px-4 text-[14px] font-semibold text-brand hover:bg-brand/15">
                올라간 공고 보기
              </Link>
              <Link href={`/admin/jobs/${posting.jobId}/edit`} className="flex h-10 items-center rounded-control bg-bg px-4 text-[14px] font-semibold text-muted hover:text-ink">
                공고 내용 고치기
              </Link>
              {posting.closed && <span className="flex h-10 items-center text-[13px] text-muted">담당자가 마감해 공고는 숨겨졌어요. 다시 올리려면 공고 관리에서 &lsquo;다시 올리기&rsquo;.</span>}
            </div>
          )}
        </section>
      )}

      {/* ③ 추천 강사 */}
      <section aria-labelledby="matches-title" className="mt-4 rounded-card bg-white p-5 md:p-6">
        <h2 id="matches-title" className="text-[17px] font-bold text-ink">
          ③ 추천 강사 <span className="nums text-brand">{matches.length}</span>명
        </h2>
        {matches.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">아직 추천한 강사가 없어요. 아래 ④에서 골라 주세요.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {matches.map((m) => {
              const p = profileOf.get(m.memberId);
              const badge = (
                <>
                  {m.applied && <span className="rounded-badge bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok">직접 지원</span>}
                  <span className={`rounded-badge px-2 py-0.5 text-[11px] font-semibold ${MATCH_STATUS_STYLE[m.status]}`}>{m.status}</span>
                  {m.chosen && <span className="rounded-badge bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">기관 선택</span>}
                </>
              );
              const controls = (
                <>
                  {m.applyMessage && (
                    <p className="mb-2 rounded-control bg-ok/10 px-3 py-2 text-[13px] leading-relaxed text-ink">
                      <b className="text-ok">지원하며 남긴 말</b> &ldquo;{m.applyMessage}&rdquo;
                    </p>
                  )}
                  {m.applyProfileName && (
                    <p className="mb-2 flex flex-wrap items-center gap-2 rounded-control bg-bg px-3 py-2 text-[14px]">
                      <span className="font-semibold text-muted">지원 프로필 파일</span>
                      <a href={`${basePath}/plan/${m.id}?kind=profile`} className="min-w-0 max-w-[260px] truncate font-semibold text-brand hover:underline">
                        {m.applyProfileName}
                      </a>
                    </p>
                  )}
                  <PlanUpload requestId={request.id} matchId={m.id} planName={m.planName} />
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="min-w-0 md:w-[420px]">
                      <MatchStatusButtons requestId={request.id} matchId={m.id} status={m.status} />
                    </div>
                    <div className="flex items-center gap-3 md:ml-auto">
                      <span className="nums text-[12px] text-muted">{formatKoreanDate(m.updatedDate)} 바꿈</span>
                      <RemoveMatchButton requestId={request.id} matchId={m.id} name={p?.name ?? names.get(m.memberId) ?? "이"} />
                    </div>
                  </div>
                </>
              );
              if (p) {
                return (
                  <ProfileRow key={m.id} profile={p} badge={badge}>
                    {controls}
                  </ProfileRow>
                );
              }
              // 프로필 없이 직접 지원한 강사 (올린 파일로 본다). 프로필을 지운 추천 강사는 데이터베이스가 줄도 함께 지운다.
              if (!m.applied) return null;
              return (
                <li key={m.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold text-ink">{names.get(m.memberId) ?? "이름 없음"}</span>
                    <span className="rounded-badge bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">프로필 미등록 · 파일로 지원</span>
                    {badge}
                  </div>
                  <div className="mt-3">{controls}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ④ 강사 고르기 */}
      <section aria-labelledby="pick-title" className="mt-4 rounded-card bg-white p-5 md:p-6">
        <h2 id="pick-title" className="text-[17px] font-bold text-ink">
          ④ 강사 고르기
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          기관 전달에 동의한 강사들이에요. 분야·지역으로 걸러 보세요. 목록에 없는 강사는{" "}
          <Link href="/admin/profiles/new" className="font-semibold text-brand hover:underline">
            강사 직접 등록
          </Link>
          으로 올릴 수 있어요.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <FilterRow basePath={basePath} label="분야" name="field" values={PROFILE_FIELDS} current={field} other={{ region }} />
          <FilterRow basePath={basePath} label="지역" name="region" values={PROFILE_REGIONS} current={region} other={{ field }} />
        </div>

        <p className="mt-4 text-sm text-muted">
          {(field || region) && <>{[field, region].filter(Boolean).join(" · ")} · </>}
          <span className="nums font-semibold text-ink">{candidates.length}</span>명
          {region && region !== "전국구" && <span className="ml-1">(전국구 강사 포함)</span>}
          {matched.size > 0 && <span className="ml-1">· 이미 추천한 강사는 빼고 보여요</span>}
        </p>
        {candidates.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">
            {profiles.length === 0 ? "아직 프로필을 낸 강사가 없어요." : "조건에 맞는 강사가 없어요."}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {candidates.map((p) => (
              <ProfileRow key={p.memberId} profile={p}>
                <AddMatchButton requestId={request.id} profileId={p.memberId} source={p.source} />
              </ProfileRow>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
