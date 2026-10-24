import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ChooseButton, ClosePostingButton, MoreForm } from "@/components/my-request-buttons";
import NotFoundCard from "@/components/not-found-card";
import { formatPhone } from "@/lib/admin-requests";
import { formatKoreanDate } from "@/lib/date";
import type { MatchStatus } from "@/lib/match-status";
import { getCurrentMember } from "@/lib/member";
import { type MyPosting, getMyPosting } from "@/lib/my-postings";
import { type MyMatch, getMyRequest, getMyRequestMatches } from "@/lib/my-requests";

export const metadata: Metadata = { title: "추천 강사", robots: { index: false, follow: false } };

/** 버튼을 누르고 돌아왔을 때(?done=… / ?failed=…) 띄울 안내 */
const NOTICES: Record<string, { ok: boolean; text: string }> = {
  "done=chosen": { ok: true, text: "강사님을 골랐어요. 운영자가 강사님과 일정을 맞춘 뒤 연락드릴게요." },
  "done=unchosen": { ok: true, text: "선택을 취소했어요." },
  "done=more": { ok: true, text: "다른 강사를 찾아 달라고 전했어요. 새 강사님이 추천되면 이 화면에 보여요." },
  "failed=choose": { ok: false, text: "강사님을 고르지 못했어요. 잠시 뒤에 다시 시도해 주세요." },
  "failed=more": { ok: false, text: "요청을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요." },
  "done=posting": { ok: true, text: "모집 공고를 냈어요. 운영자가 검토한 뒤 공고 목록에 올려 드릴게요." },
  "done=closed": { ok: true, text: "모집을 마감했어요. 공고가 목록에서 내려갔어요." },
  "failed=close": { ok: false, text: "모집을 마감하지 못했어요. 잠시 뒤에 다시 시도해 주세요." },
};

/** 기관에 보여 줄 진행 상태 (운영자 상태를 기관 말로) */
const STATUS_LABEL: Partial<Record<MatchStatus, { text: string; className: string }>> = {
  "연락 중": { text: "운영자가 일정을 맞추고 있어요", className: "bg-accent/10 text-accent" },
  확정: { text: "섭외 확정", className: "bg-ok text-white" },
  불발: { text: "이번엔 함께하기 어려워요", className: "bg-bg text-muted" },
};

/**
 * 기관 담당자 · 내 의뢰 하나의 추천 강사.
 * - 운영자가 기관을 확인하기 전에는 안내만 보인다.
 * - 추천 강사마다 프로필(작성한 내용 또는 파일)과 강의계획서를 보고 '이 강사님으로 할게요'를 누른다 (여러 명, 취소 가능).
 * - 마음에 드는 강사가 없으면 '다른 강사를 원해요' + 한 줄 의견.
 * - 강사 연락처는 운영자가 '섭외 확정'으로 바꾼 강사만 보인다.
 * - 강사 모집 공고: 의뢰마다 하나 쓸 수 있다 (운영자 검토 뒤 공고 목록에 게시). 승인된 공고는 '모집 마감'으로 내린다.
 */
export default async function MyRequestPage({ params, searchParams }: PageProps<"/account/requests/[id]">) {
  await connection();
  const { id } = await params;
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(`/account/requests/${id}`)}`);

  const request = await getMyRequest(id);
  if (!request) {
    return (
      <NotFoundCard
        title="의뢰를 찾을 수 없어요"
        description="주소가 틀렸거나, 이 계정으로 보낸 의뢰가 아니에요."
        primary={{ href: "/account/requests", label: "내 의뢰로" }}
      />
    );
  }
  const [matches, posting] = await Promise.all([request.verified ? getMyRequestMatches(request.id) : [], getMyPosting(request.id)]);
  const open = matches.filter((m) => m.status !== "불발");

  const sp = await searchParams;
  const key = sp.done ? `done=${sp.done}` : sp.failed ? `failed=${sp.failed}` : "";
  const notice = NOTICES[key];

  const details: [string, string | undefined][] = [
    ["희망 일정", request.schedule],
    ["수업 대상", request.target],
    ["필요한 강사 수", request.headcount ? `${request.headcount}명` : undefined],
    ["예산·강사료", request.budget],
    ["요청 사항", request.message],
  ];

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <Link href="/account/requests" className="text-sm font-semibold text-muted hover:text-ink">
        ← 내 의뢰
      </Link>
      <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">{request.subject}</h1>
      <p className="mt-1 text-[15px] text-muted">
        {request.orgName} · <span className="nums">{formatKoreanDate(request.sentDate)}</span> 보냄
      </p>

      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`mt-4 rounded-card px-5 py-4 text-[15px] font-semibold ${notice.ok ? "bg-ok/10 text-ok" : "bg-warn/8 text-warn"}`}
        >
          {notice.text}
        </p>
      )}

      <details className="mt-4 rounded-card bg-white p-5">
        <summary className="cursor-pointer text-[15px] font-semibold text-ink">보낸 의뢰 내용 보기</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14px] md:grid-cols-[110px_minmax(0,1fr)]">
          {details
            .filter((d): d is [string, string] => Boolean(d[1]))
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold text-muted">{label}</dt>
                <dd className="mb-2 whitespace-pre-line text-ink md:mb-0">{value}</dd>
              </div>
            ))}
        </dl>
      </details>

      <PostingCard requestId={request.id} posting={posting} />

      {!request.verified ? (
        <div className="mt-4 rounded-card bg-white p-6 text-center">
          <p className="text-[17px] font-bold text-ink">운영자가 의뢰를 확인하고 있어요</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            기관 확인을 위해 기관 대표번호나 담당자 연락처로 연락드릴 수 있어요.
            <br />
            확인이 끝나면 추천 강사님이 이 화면에 보여요.
          </p>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-[20px] font-bold tracking-tight text-ink">
            추천 강사 <span className="nums text-brand">{open.length}</span>명
          </h2>
          <p className="mt-1 text-[14px] text-muted">
            프로필과 강의계획서를 보고 마음에 드는 강사님을 골라 주세요. 여러 명 고를 수 있어요.
            <br />
            강사님 연락처는 섭외가 확정되면 보여요.
          </p>

          {matches.length === 0 ? (
            <p className="mt-4 rounded-card bg-white p-6 text-center text-[15px] text-muted">운영자가 의뢰에 맞는 강사님을 찾고 있어요.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {matches.map((m) => (
                <MatchCard key={m.id} requestId={request.id} match={m} />
              ))}
            </ul>
          )}

          <div className="mt-6 rounded-card bg-white p-5 md:p-6">
            <h2 className="text-[17px] font-bold text-ink">마음에 드는 강사님이 없나요?</h2>
            {request.moreRequested ? (
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                다른 강사를 찾아 달라고 전했어요. 새 강사님이 추천되면 이 화면에 보여요.
                {request.moreNote && <span className="mt-1 block text-ink">남기신 말: &ldquo;{request.moreNote}&rdquo;</span>}
              </p>
            ) : (
              <MoreForm requestId={request.id} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** 강사 모집 공고 칸: 아직 안 썼으면 쓰기 안내, 썼으면 검토 상태와 할 수 있는 일 */
function PostingCard({ requestId, posting }: { requestId: string; posting: MyPosting | null }) {
  const writeHref = `/account/requests/${requestId}/posting`;
  const linkClass = "flex h-11 items-center justify-center rounded-control px-4 text-[14px] font-semibold transition-colors";

  if (!posting) {
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-card bg-white p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h2 className="text-[17px] font-bold text-ink">강사 모집 공고도 올려 보세요</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            공고 목록에 올라가 더 많은 강사님이 볼 수 있어요. 운영자가 검토한 뒤 올려 드려요.
          </p>
        </div>
        <Link href={writeHref} className={`${linkClass} shrink-0 bg-brand text-white hover:bg-brand/90`}>
          공고 쓰기
        </Link>
      </div>
    );
  }

  const badge =
    posting.status === "승인"
      ? posting.closed
        ? { text: "모집 마감함", className: "bg-bg text-muted" }
        : { text: "공고 게시 중", className: "bg-ok text-white" }
      : posting.status === "반려"
        ? { text: "반려됨", className: "bg-warn text-white" }
        : { text: "운영자 검토 중", className: "bg-brand/10 text-brand" };

  return (
    <div className="mt-4 rounded-card bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[17px] font-bold text-ink">강사 모집 공고</h2>
        <span className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>
      <p className="mt-1.5 text-[15px] font-semibold text-ink">{posting.values.title}</p>
      <p className="nums mt-0.5 text-[13px] text-muted">
        지원 마감 {formatKoreanDate(posting.values.deadline)} · {formatKoreanDate(posting.submittedDate)} 냄
        {posting.reviewedDate && ` · ${formatKoreanDate(posting.reviewedDate)} 처리`}
      </p>

      {posting.status === "반려" && (
        <p className="mt-3 rounded-control bg-warn/8 px-4 py-3 text-[14px] leading-relaxed text-warn">
          <b>운영자가 이렇게 알려 왔어요:</b> {posting.reviewNote ?? "내용을 다시 확인해 주세요."}
        </p>
      )}
      {posting.status === "검토 중" && (
        <p className="mt-3 text-[14px] leading-relaxed text-muted">운영자가 내용을 확인하고 있어요. 승인되면 공고 목록에 올라가요.</p>
      )}
      {posting.status === "승인" && !posting.closed && (
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          공고 목록에 올라가 있어요. 지원은 강사잇다가 받아 이 화면의 추천 강사로 전달해 드려요. 내용을 고치려면 운영자에게 알려 주세요.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {posting.status === "승인" && !posting.closed && (
          <>
            <Link href={`/jobs/${posting.jobId}`} className={`${linkClass} bg-brand/10 text-brand hover:bg-brand/15`}>
              올라간 공고 보기
            </Link>
            <ClosePostingButton requestId={requestId} />
          </>
        )}
        {posting.status !== "승인" && (
          <Link href={writeHref} className={`${linkClass} bg-brand text-white hover:bg-brand/90`}>
            {posting.status === "반려" ? "고쳐서 다시 내기" : "내용 고치기"}
          </Link>
        )}
      </div>
    </div>
  );
}

function MatchCard({ requestId, match: m }: { requestId: string; match: MyMatch }) {
  const label = STATUS_LABEL[m.status];
  const closed = m.status === "불발";
  const fileHref = (kind: "plan" | "profile") => `/account/requests/${requestId}/file/${m.id}?kind=${kind}`;

  return (
    <li className={`rounded-card bg-white p-5 md:p-6 ${closed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[19px] font-bold tracking-tight text-ink">{m.name} 강사님</span>
        {m.chosen && !closed && <span className="rounded-badge bg-brand px-2.5 py-0.5 text-[12px] font-semibold text-white">내가 고른 강사</span>}
        {label && <span className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${label.className}`}>{label.text}</span>}
      </div>
      <p className="mt-1 text-[14px] text-ink">
        {m.fields.join(" · ")}
        <span className="mx-1.5 text-line">|</span>
        <span className="text-muted">{m.regions.join(" · ")}</span>
      </p>

      {m.method === "form" ? (
        <div className="mt-4 flex flex-col gap-3 rounded-control bg-bg p-4 text-[14px] leading-relaxed text-ink">
          <Block title="강의 경력" text={m.career} />
          {m.certificates && <Block title="자격·학력" text={m.certificates} />}
          {m.intro && <Block title="자기소개" text={m.intro} />}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        {m.fileName && <FileLink href={fileHref("profile")} label="프로필 파일" name={m.fileName} />}
        {m.planName ? (
          <FileLink href={fileHref("plan")} label="강의계획서" name={m.planName} />
        ) : (
          <p className="flex h-12 items-center rounded-control bg-bg px-4 text-[14px] text-muted md:flex-1">강의계획서는 준비 중이에요</p>
        )}
      </div>

      {m.status === "확정" && (m.phone || m.email) && (
        <div className="mt-3 flex flex-col gap-1 rounded-control bg-ok/10 px-4 py-3 text-[15px] md:flex-row md:gap-5">
          <span className="font-semibold text-ok">강사님 연락처</span>
          {m.phone && (
            <a href={`tel:${m.phone}`} className="nums font-semibold text-ink hover:underline">
              {formatPhone(m.phone)}
            </a>
          )}
          {m.email && (
            <a href={`mailto:${m.email}`} className="break-all font-semibold text-ink hover:underline">
              {m.email}
            </a>
          )}
        </div>
      )}

      {!closed && m.status !== "확정" && (
        <div className={`mt-4 ${m.chosen ? "flex items-center justify-between gap-3" : ""}`}>
          {m.chosen && <p className="text-[14px] font-semibold text-brand">고르셨어요. 운영자가 곧 연락드릴게요.</p>}
          <ChooseButton requestId={requestId} matchId={m.id} chosen={m.chosen} />
        </div>
      )}
    </li>
  );
}

function FileLink({ href, label, name }: { href: string; label: string; name: string }) {
  return (
    <a
      href={href}
      className="flex h-12 min-w-0 items-center gap-2 rounded-control bg-brand/8 px-4 text-[14px] font-semibold text-brand hover:bg-brand/12 md:flex-1"
    >
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 truncate font-medium text-brand/80">{name}</span>
      <span className="ml-auto shrink-0">내려받기</span>
    </a>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-muted">{title}</p>
      <p className="mt-0.5 whitespace-pre-line">{text}</p>
    </div>
  );
}
