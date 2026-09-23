"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, isTabActive } from "@/components/nav-tabs";

/** PC 화면(가로 768px 이상)의 위쪽 메뉴. 휴대폰에서는 숨기고 하단 탭을 쓴다. */
export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = isTabActive(tab.href, pathname);

          return (
            <li key={tab.href}>
              {/* 하단 탭과 같은 표시 방식: 지금 보는 메뉴는 연보라 알약 + 굵은 보라 글씨 */}
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-10 items-center rounded-badge px-4 text-[15px] transition-colors ${
                  isActive ? "bg-brand/12 font-bold text-brand" : "font-medium text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
