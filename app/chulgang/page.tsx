import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import ChulgangApp from "@/components/chulgang-app";
import { checkAdmin } from "@/lib/admin";
import { CHULGANG_CSS, CHULGANG_HTML } from "@/lib/chulgang/assets";

export const metadata: Metadata = { title: "출강잇다", robots: { index: false, follow: false } };

/**
 * 출강잇다 (`/chulgang`). 내 Google 캘린더를 연결해 강의 일정·강의료·입금 여부·준비물을 한 화면에서 관리한다.
 * 기록은 각 강사의 Google 캘린더 일정 설명란에만 저장하고, 강사잇다 DB 에는 아무것도 남기지 않는다 (docs/SPEC.md 4-7).
 *
 * 지금은 정식 오픈 전(특허 출원 전, 2026-11-08)이라 비공개: 관리자(운영자) 계정만 열 수 있고, 다른 사람에게는 없는 페이지(404)다.
 * 홈·마이페이지에도 들어가는 버튼이 없다. 오픈할 때: 아래 관리자 확인을 '강사 회원' 확인으로 바꾸고 버튼을 다시 단다 (SPEC 4-7).
 */
export default async function ChulgangPage() {
  await connection();
  if (!(await checkAdmin("/chulgang"))) notFound();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CHULGANG_CSS }} />
      {/* 휴대폰에서는 사이트 좌우 여백 대신 출강잇다 화면의 여백을 쓴다 (여백이 두 번 들어가 달력이 좁아지지 않게) */}
      <div className="-mx-4 -mt-5 md:mx-0 md:-mt-5" dangerouslySetInnerHTML={{ __html: CHULGANG_HTML }} />
      <ChulgangApp />
    </>
  );
}
