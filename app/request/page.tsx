import type { Metadata } from "next";
import RequestForm from "./request-form";

export const metadata: Metadata = { title: "강사섭외" };

/** 강사섭외 의뢰서. 학교·기관 담당자가 로그인 없이 보낸다. */
export default function RequestPage() {
  return (
    <section className="mx-auto w-full max-w-[560px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사섭외</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        강사가 필요한 학교·기관은 아래 의뢰서를 남겨 주세요.
        <br />
        확인한 뒤 담당자 연락처로 연락드립니다.
      </p>
      <div className="mt-5">
        <RequestForm />
      </div>
    </section>
  );
}
