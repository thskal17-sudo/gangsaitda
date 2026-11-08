"use client";

import Script from "next/script";
import { CHULGANG_BODY_HTML } from "@/components/chulgang-body";

/*
 * 출강잇다 화면 본체. 강사가 자기 Google 캘린더를 연결해 강의 일정·강의료·입금·준비물을 관리한다.
 * - 화면(HTML)은 components/chulgang-body.ts, 모양은 app/chulgang/chulgang.css (.cg 안에서만 적용), 동작은 public/chulgang/chulgang.js.
 * - 기록은 각 강사의 Google 캘린더 일정 설명란에만 남는다. 강사잇다 서버·DB 에는 아무것도 저장하지 않는다.
 * - Google 로그인 열쇠(토큰)는 브라우저 메모리에만 있고 1시간쯤 지나면 다시 연결해야 한다.
 * - NEXT_PUBLIC_GOOGLE_CLIENT_ID (Google OAuth 클라이언트 ID, 비밀 값 아님)가 없으면 화면은 열리지만 연결 버튼이 동작하지 않는다.
 */

declare global {
  interface Window {
    Chulgang?: { mount: (opts: { clientId?: string; root?: HTMLElement }) => void };
  }
}

export default function ChulgangApp() {
  return (
    <>
      {/* 휴대폰에서는 사이트 좌우 여백 대신 출강잇다 화면의 여백을 쓴다 (여백이 두 번 들어가 달력이 좁아지지 않게) */}
      <div className="-mx-4 -mt-5 md:mx-0 md:-mt-5" dangerouslySetInnerHTML={{ __html: CHULGANG_BODY_HTML }} />
      {/* 처음 불러올 때와, 다른 화면에 갔다가 돌아올 때마다 한 번씩 연결한다 (mount 는 같은 화면에 두 번 불러도 한 번만 동작) */}
      <Script
        src="/chulgang/chulgang.js"
        onReady={() => window.Chulgang?.mount({ clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID })}
      />
    </>
  );
}
