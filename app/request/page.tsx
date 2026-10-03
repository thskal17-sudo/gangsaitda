import type { Metadata } from "next";
import { MembersOnlyNotice } from "@/components/job-detail";
import { getCurrentMember } from "@/lib/member";
import RequestForm from "./request-form";

export const metadata: Metadata = { title: "강사섭외" };

/**
 * 강사섭외 의뢰서. 학교·기관 담당자가 **회원가입(강사와 같은 가입) 후** 보낸다.
 * 비회원에게는 의뢰서 대신 가입·로그인 안내를 보여주고, 가입·로그인하면 이 화면으로 돌아온다.
 * 회사소개서 PDF 는 비회원도 내려받을 수 있다.
 */
export default async function RequestPage() {
  const member = await getCurrentMember();

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사섭외</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        강사가 필요한 학교·기관은 아래 의뢰서를 남겨 주세요.
        <br />
        확인한 뒤 담당자 연락처로 연락드립니다.
      </p>
      {/* 회사소개서: 담당자가 내부 보고용으로 내려받는다 (public/gangsaitda-company-intro.pdf) */}
      <a
        href="/gangsaitda-company-intro.pdf"
        download="gangsaitda-company-intro.pdf"
        className="group mt-5 flex items-center gap-4 rounded-card bg-white p-5 transition-transform duration-150 active:scale-[0.98]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
          <DownloadIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold tracking-tight text-ink">강사잇다 회사소개서</span>
          <span className="nums mt-0.5 block text-[13px] text-muted">PDF · 12쪽 · 3.2MB</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-brand group-hover:underline">내려받기</span>
      </a>
      <div className="mt-5">
        {member ? (
          <RequestForm />
        ) : (
          <MembersOnlyNotice
            next="/request"
            title="의뢰서는 회원만 쓸 수 있어요"
            description="가입하거나 로그인하면 의뢰서를 바로 쓸 수 있습니다."
            cta="무료 회원가입하고 의뢰하기"
          />
        )}
      </div>
    </section>
  );
}

function DownloadIcon() {
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
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
