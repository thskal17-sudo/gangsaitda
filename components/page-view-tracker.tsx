"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * 화면이 열릴 때마다 '어느 화면인지'를 /api/pv 로 알린다 (운영자 현황의 열람 수).
 * 처음 들어온 화면에서만 이전 사이트의 이름(예: search.naver.com)과 홍보 링크 이름표(?from=…)를 함께 보낸다.
 * 이전 주소 전체(검색어 등)는 보내지 않는다.
 * 쿠키·브라우저 저장소를 쓰지 않으므로 누가 왔는지는 알 수 없다.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // 같은 화면을 두 번 세지 않는다 (개발 모드에서 화면이 두 번 그려지는 경우 등)
    if (!pathname || lastPath.current === pathname) return;
    const isFirst = lastPath.current === null;
    lastPath.current = pathname;

    let entry = {};
    if (isFirst) {
      let ref = "";
      try {
        ref = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        // 주소 모양이 이상하면 이전 주소 없이 들어온 것으로 본다.
      }
      // 홍보 링크 이름표: 주소 끝의 ?from=블로그1 (또는 광고용 utm_source·utm_campaign)
      const q = new URLSearchParams(window.location.search);
      entry = { ref, from: q.get("from"), utm_source: q.get("utm_source"), utm_campaign: q.get("utm_campaign") };
    }
    const body = JSON.stringify({ path: pathname, ...entry });
    try {
      if (!navigator.sendBeacon?.("/api/pv", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/pv", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {
      // 세기에 실패해도 화면에는 아무 영향이 없게 한다.
    }
  }, [pathname]);

  return null;
}
