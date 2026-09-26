"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LOGOUT_TAB, SIGNUP_TAB, TABS, isTabActive } from "@/components/nav-tabs";
import { logout } from "@/lib/auth-actions";

/** 휴대폰 화면의 하단 탭. PC(가로 768px 이상)에서는 숨기고 위쪽 메뉴를 쓴다. */
export default function BottomNav({ isMember }: { isMember: boolean }) {
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
              <Link href={tab.href} aria-current={isActive ? "page" : undefined} className={ITEM_CLASS}>
                <TabFace icon={tab.icon} label={tab.label} isActive={isActive} />
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          {isMember ? (
            <form action={logout} className="h-full">
              <LogoutTabButton />
            </form>
          ) : (
            <Link
              href={SIGNUP_TAB.href}
              aria-current={pathname === SIGNUP_TAB.href ? "page" : undefined}
              className={ITEM_CLASS}
            >
              <TabFace icon={SIGNUP_TAB.icon} label={SIGNUP_TAB.label} isActive={pathname === SIGNUP_TAB.href} />
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}

const ITEM_CLASS = "flex h-16 w-full flex-col items-center justify-center gap-0.5";

function LogoutTabButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${ITEM_CLASS} disabled:opacity-60`}>
      <TabFace icon={LOGOUT_TAB.icon} label={pending ? "나가는 중…" : LOGOUT_TAB.label} isActive={false} />
    </button>
  );
}

/** 탭 한 칸의 모양: 아이콘 + 이름 */
function TabFace({ icon, label, isActive }: { icon: ReactNode; label: string; isActive: boolean }) {
  return (
    <>
      {/* 지금 보고 있는 탭은 연파랑 알약 배경 + 파란 아이콘,
          나머지는 배경 없이 회색. 색 하나에만 기대지 않게 한다. */}
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-badge transition-colors ${
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
          {icon}
        </svg>
      </span>
      <span
        className={`text-[11px] whitespace-nowrap transition-colors ${
          isActive ? "font-bold text-brand" : "font-medium text-muted"
        }`}
      >
        {label}
      </span>
    </>
  );
}
