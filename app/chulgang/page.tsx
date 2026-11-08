import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import ChulgangApp from "@/components/chulgang-app";
import MemberTypeNotice from "@/components/member-type-notice";
import { getCurrentMember, getMemberType } from "@/lib/member";
import "./chulgang.css";

export const metadata: Metadata = { title: "출강잇다", robots: { index: false, follow: false } };

/**
 * 출강잇다 (`/chulgang`, 강사 회원 전용). 내 Google 캘린더를 연결해 강의 일정·강의료·입금 여부·준비물을 한 화면에서 관리한다.
 * 기록은 각 강사의 Google 캘린더 일정 설명란에만 저장하고, 강사잇다 DB 에는 아무것도 남기지 않는다 (docs/SPEC.md 4-7).
 * 비회원은 로그인 화면으로, 기관 회원에게는 '강사 회원 전용' 안내를 보여 준다.
 */
export default async function ChulgangPage() {
  await connection();
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/chulgang");
  if ((await getMemberType()) === "기관") {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">출강잇다</h1>
        <div className="mt-5">
          <MemberTypeNotice need="강사" description="기관 담당자로 가입하셔서 출강잇다(강의 일정·강의료 관리)를 쓸 수 없어요." />
        </div>
      </section>
    );
  }
  return <ChulgangApp />;
}
