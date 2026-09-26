"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 위쪽 띠 오른쪽의 '로그인' 버튼 (비회원에게만, 휴대폰·PC 모두).
 * 로그인 뒤 지금 보던 화면으로 돌아온다. 회원의 '로그아웃'은 메뉴 마지막 칸에 있다.
 */
export default function HeaderAuth({ isMember }: { isMember: boolean }) {
  const pathname = usePathname();

  // 회원이거나, 가입·로그인·계정 찾기 화면이면 숨긴다.
  if (isMember || ["/login", "/signup", "/find-email", "/find-password"].includes(pathname)) return null;

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
