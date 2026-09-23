"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 하단 탭 메뉴.
 * 메뉴를 늘리거나 이름을 바꿀 때는 아래 TABS 배열만 고치면 된다.
 */
const TABS = [
  {
    href: "/",
    label: "홈",
    icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    href: "/jobs",
    label: "공고",
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
        <path d="M3 12h18" />
      </>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

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
