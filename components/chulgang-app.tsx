"use client";

import Script from "next/script";

/*
 * 출강잇다 동작 코드 불러오기. 강사가 자기 Google 캘린더를 연결해 강의 일정·강의료·입금·준비물을 관리한다.
 * - 화면(HTML)·모양(CSS)은 app/chulgang/page.tsx 가 서버에서 넣고, 동작(JS)은 /chulgang/app-script 에서 관리자에게만 받는다 (lib/chulgang/assets.ts).
 * - 기록은 각 강사의 Google 캘린더 일정 설명란에만 남는다. 강사잇다 서버·DB 에는 아무것도 저장하지 않는다.
 * - Google 로그인 열쇠(토큰)는 브라우저 메모리에만 있고 1시간쯤 지나면 다시 연결해야 한다.
 * - Google OAuth 클라이언트 ID: 환경 변수 NEXT_PUBLIC_GOOGLE_CLIENT_ID 가 있으면 그것, 없으면 GOOGLE_CLIENT_ID.
 */

/**
 * 출강잇다 Google OAuth 클라이언트 ID (Google Cloud 프로젝트 chulgang-itda, '출강잇다 웹').
 * 비밀 값이 아니다 (브라우저에 그대로 보이는 값). 승인된 원본: https://www.gangsaitda.com, https://gangsaitda.com, http://localhost:3000.
 * 클라이언트 보안 비밀(Client secret)은 쓰지 않고, 어디에도 넣지 않는다.
 */
const GOOGLE_CLIENT_ID = "285647480179-jsrea9fus8mna09iosda9uoup0de4igk.apps.googleusercontent.com";

declare global {
  interface Window {
    Chulgang?: { mount: (opts: { clientId?: string; root?: HTMLElement }) => void };
  }
}

export default function ChulgangApp() {
  return (
    // 처음 불러올 때와, 다른 화면에 갔다가 돌아올 때마다 한 번씩 연결한다 (mount 는 같은 화면에 두 번 불러도 한 번만 동작)
    <Script
      src="/chulgang/app-script"
      onReady={() => window.Chulgang?.mount({ clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID })}
    />
  );
}
