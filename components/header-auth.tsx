"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 위쪽 띠 오른쪽 끝 버튼 (휴대폰·PC 모두).
 * - 비회원: '로그인'. 로그인 뒤 지금 보던 화면으로 돌아온다. 가입·로그인·계정 찾기 화면에서는 숨긴다.
 * - 회원: '마이페이지' (/account). 회원의 '로그아웃'은 메뉴 마지막 칸과 마이페이지에 있다.
 */
export default function HeaderAuth({ isMember }: { isMember: boolean }) {
  const pathname = usePathname();

  if (isMember) {
    const active = pathname === "/account" || pathname.startsWith("/account/");
    return (
      <Link
        href="/account"
        aria-current={active ? "page" : undefined}
        className={`flex h-9 items-center rounded-control px-3.5 text-sm font-semibold transition-colors ${
          active ? "bg-brand text-white" : "bg-brand/10 text-brand hover:bg-brand/15"
        }`}
      >
        마이페이지
      </Link>
    );
  }

  if (["/login", "/signup", "/find-email", "/find-password"].includes(pathname)) return null;

  const query = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return (
    <Link
      href={`/login${query}`}
      className="flex h-9 items-center rounded-control bg-brand/10 px-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/15"
    >
      로그인
    </Link>
  );
}
