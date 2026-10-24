import type { Metadata } from "next";
import Link from "next/link";
import { MembersOnlyNotice } from "@/components/job-detail";
import MemberTypeNotice from "@/components/member-type-notice";
import { getCurrentMember, getMemberType } from "@/lib/member";
import RequestForm from "./request-form";

export const metadata: Metadata = { title: "강사섭외" };

/**
 * 강사섭외 의뢰서. 학교·기관 담당자가 **기관 담당자로 회원가입한 뒤** 보낸다.
 * 비회원에게는 의뢰서 대신 가입·로그인 안내를 보여주고, 가입·로그인하면 이 화면으로 돌아온다.
 * 강사 회원에게는 의뢰서 대신 '기관 담당자 전용' 안내를 보여준다.
 * 활용설명서(/guide) 칸은 모두에게 보이지만, 설명서 자체는 기관 담당자 회원만 연다.
 */
export default async function RequestPage() {
  const member = await getCurrentMember();
  const memberType = await getMemberType();

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사섭외</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        강사가 필요한 학교·기관은 아래 의뢰서를 남겨 주세요.
        <br />
        확인한 뒤 담당자 연락처로 연락드립니다.
      </p>
      {/* 활용설명서: 기관 담당자 회원만 본다 (/guide). 나머지에게는 가입하면 볼 수 있다는 안내 */}
      <Link
        href="/guide"
        className="group mt-5 flex items-center gap-4 rounded-card bg-white p-5 transition-transform duration-150 active:scale-[0.98]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
          <BookIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold tracking-tight text-ink">강사잇다 활용설명서</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {memberType === "기관" ? "의뢰부터 강사 고르기, 확정까지 순서대로" : "기관 담당자 회원만 볼 수 있어요"}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-brand group-hover:underline">보기</span>
      </Link>
      <div className="mt-5">
        {member && memberType === "강사" ? (
          <MemberTypeNotice need="기관" />
        ) : member ? (
          <RequestForm />
        ) : (
          <MembersOnlyNotice
            next="/request"
            title="의뢰서는 회원만 쓸 수 있어요"
            description="가입하거나 로그인하면 의뢰서를 바로 쓸 수 있습니다."
            cta="기관 담당자로 가입하고 의뢰하기"
          />
        )}
      </div>
    </section>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M8 7h8M8 11h6" />
    </svg>
  );
}
