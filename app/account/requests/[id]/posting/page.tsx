import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import MemberTypeNotice from "@/components/member-type-notice";
import NotFoundCard from "@/components/not-found-card";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { getMyPosting } from "@/lib/my-postings";
import { getMyRequest } from "@/lib/my-requests";
import { prefillPosting } from "@/lib/posting-schema";
import PostingForm from "./posting-form";

export const metadata: Metadata = { title: "강사 모집 공고 쓰기", robots: { index: false, follow: false } };

/**
 * 기관 담당자 · 의뢰 하나에 강사 모집 공고 쓰기. 처음에는 의뢰 내용으로 미리 채워 준다.
 * 검토 중이거나 반려된 공고는 고쳐서 다시 낼 수 있고, 승인된 공고는 여기서 고칠 수 없다 (의뢰 화면에서 '모집 마감'만).
 */
export default async function PostingPage({ params }: PageProps<"/account/requests/[id]/posting">) {
  await connection();
  const { id } = await params;
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(`/account/requests/${id}/posting`)}`);
  if ((await getMemberType()) === "강사") {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <MemberTypeNotice need="기관" />
      </section>
    );
  }

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
  const posting = await getMyPosting(request.id);
  if (posting?.status === "승인") redirect(`/account/requests/${request.id}`);

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <Link href={`/account/requests/${request.id}`} className="text-sm font-semibold text-muted hover:text-ink">
        ← {request.subject}
      </Link>
      <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">
        {posting ? "모집 공고 고치기" : "강사 모집 공고 쓰기"}
      </h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        강사잇다 공고 목록에 올릴 글이에요. 운영자가 검토한 뒤 올려 드려요.
      </p>

      {posting?.status === "반려" && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] leading-relaxed text-warn">
          <b>운영자가 이렇게 알려 왔어요:</b> {posting.reviewNote ?? "내용을 다시 확인해 주세요."}
          <br />
          <span className="text-ink">고쳐서 다시 검토를 요청해 주세요.</span>
        </p>
      )}

      <div className="mt-5">
        <PostingForm requestId={request.id} values={posting?.values ?? prefillPosting(request)} resubmit={Boolean(posting)} />
      </div>
    </section>
  );
}
