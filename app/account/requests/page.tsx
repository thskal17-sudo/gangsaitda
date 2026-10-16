import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { formatKoreanDate } from "@/lib/date";
import { getCurrentMember } from "@/lib/member";
import { type MyRequest, getMyRequests } from "@/lib/my-requests";

export const metadata: Metadata = { title: "내 의뢰", robots: { index: false, follow: false } };

/**
 * 기관 담당자 · 내 의뢰 목록. 내가 보낸 강사섭외 의뢰와 진행 상황 (추천 강사 수, 고른 강사, 확정).
 * 의뢰를 누르면 추천 강사를 보고 고르는 화면으로 간다.
 */
export default async function MyRequestsPage() {
  await connection();
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/account/requests");
  const requests = await getMyRequests();

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">내 의뢰</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        보내신 강사섭외 의뢰예요. 운영자가 기관을 확인한 뒤 의뢰에 맞는 강사님을 추천해 드려요.
      </p>

      {requests.length === 0 ? (
        <div className="mt-5 rounded-card bg-white p-6 text-center">
          <p className="text-[15px] text-muted">아직 보낸 의뢰가 없어요.</p>
          <Link
            href="/request"
            className="mx-auto mt-4 flex h-14 max-w-xs items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white hover:bg-brand/90"
          >
            강사섭외 의뢰하기
          </Link>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {requests.map((r) => (
            <li key={r.id}>
              <RequestLink request={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 의뢰 한 줄: 지금 어디까지 왔는지 한눈에 */
function RequestLink({ request: r }: { request: MyRequest }) {
  const progress = !r.verified
    ? { text: "운영자가 확인하고 있어요", className: "bg-bg text-muted" }
    : r.confirmedCount > 0
      ? { text: `섭외 확정 ${r.confirmedCount}명`, className: "bg-ok text-white" }
      : r.moreRequested
        ? { text: "다른 강사를 찾고 있어요", className: "bg-accent/10 text-accent" }
        : r.matchCount > 0
          ? { text: `추천 강사 ${r.matchCount}명`, className: "bg-brand text-white" }
          : { text: "강사님을 찾고 있어요", className: "bg-brand/10 text-brand" };

  return (
    <Link href={`/account/requests/${r.id}`} className="group block rounded-card bg-white p-5 transition-transform active:scale-[0.99] md:p-6">
      <div className="flex items-center gap-2">
        <span className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${progress.className}`}>{progress.text}</span>
        <span className="nums text-[13px] text-muted">{formatKoreanDate(r.sentDate)} 보냄</span>
      </div>
      <p className="mt-2 text-[18px] font-bold tracking-tight text-ink group-hover:text-brand">{r.subject}</p>
      <p className="mt-0.5 text-[14px] text-muted">
        {r.orgName} · {r.schedule}
      </p>
      {r.verified && r.matchCount > 0 && (
        <p className="nums mt-3 text-[14px] text-ink">
          추천 {r.matchCount}명 · 고른 강사 {r.chosenCount}명{r.confirmedCount > 0 && ` · 확정 ${r.confirmedCount}명`}
          <span className="ml-1 font-semibold text-brand">보기 →</span>
        </p>
      )}
    </Link>
  );
}
