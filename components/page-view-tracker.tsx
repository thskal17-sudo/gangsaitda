"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * 화면이 열릴 때마다 '어느 화면인지'를 /api/pv 로 알린다 (운영자 현황의 열람 수).
 * 처음 들어온 화면에서만 이전 사이트의 주소 이름(예: search.naver.com)을 함께 보낸다. 주소 전체는 보내지 않는다.
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

    let ref: string | undefined;
    if (isFirst) {
      try {
        ref = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        ref = "";
      }
    }
    const body = JSON.stringify(isFirst ? { path: pathname, ref } : { path: pathname });
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
