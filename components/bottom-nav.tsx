"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, isTabActive } from "@/components/nav-tabs";

/** 휴대폰 화면의 하단 탭. PC(가로 768px 이상)에서는 숨기고 위쪽 메뉴를 쓴다. */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const isActive = isTabActive(tab.href, pathname);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className="flex h-16 flex-col items-center justify-center gap-0.5"
              >
                {/* 지금 보고 있는 탭은 연보라 알약 배경 + 진한 보라 아이콘,
                    나머지는 배경 없이 회색. 색 하나에만 기대지 않게 한다. */}
                <span
                  className={`flex h-8 w-16 items-center justify-center rounded-badge transition-colors ${
                    isActive ? "bg-brand/12 text-brand" : "text-muted"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.1 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[22px] w-[22px]"
                    aria-hidden="true"
                  >
                    {tab.icon}
                  </svg>
                </span>
                <span
                  className={`text-[11px] transition-colors ${
                    isActive ? "font-bold text-brand" : "font-medium text-muted"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
