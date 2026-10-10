"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { LOGOUT_TAB, SIGNUP_TAB, TABS, isTabActive } from "@/components/nav-tabs";
import { logout } from "@/lib/auth-actions";

/** PC 화면(가로 768px 이상)의 위쪽 메뉴. 휴대폰에서는 숨기고 하단 탭을 쓴다. */
export default function TopNav({ isMember }: { isMember: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = isTabActive(tab.href, pathname);
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={isActive ? "page" : undefined} className={itemClass(isActive)}>
                {tab.label}
              </Link>
            </li>
          );
        })}

        <li>
          {isMember ? (
            <form action={logout}>
              <LogoutButton />
            </form>
          ) : (
            <Link
              href={SIGNUP_TAB.href}
              aria-current={pathname === SIGNUP_TAB.href ? "page" : undefined}
              className={itemClass(pathname === SIGNUP_TAB.href)}
            >
              {SIGNUP_TAB.label}
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}

/* 지금 보는 메뉴는 굵은 검정 글씨, 나머지는 회색 (알약 배경 없이 담백하게) */
function itemClass(isActive: boolean) {
  return `flex h-10 items-center px-3.5 text-[15px] transition-colors ${isActive ? "font-bold text-ink" : "font-medium text-muted hover:text-ink"}`;
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${itemClass(false)} disabled:opacity-60`}>
      {pending ? "나가는 중…" : LOGOUT_TAB.label}
    </button>
  );
}
