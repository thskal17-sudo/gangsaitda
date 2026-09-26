"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { logout } from "@/lib/auth-actions";

/**
 * 위쪽 띠 오른쪽의 로그인/로그아웃 버튼. 휴대폰·PC 모두 보인다.
 * 비회원: '로그인' (로그인 뒤 지금 보던 화면으로 돌아온다)
 * 회원: '로그아웃' (누르면 지금 화면에 그대로 머문다)
 */
export default function HeaderAuth({ isMember }: { isMember: boolean }) {
  const pathname = usePathname();

  // 가입·로그인 화면에서는 같은 곳으로 가는 버튼이라 숨긴다.
  if (pathname === "/login" || pathname === "/signup") return null;

  if (isMember) {
    return (
      <form action={logout}>
        <LogoutButton />
      </form>
    );
  }

  const query = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return (
    <Link
      href={`/login${query}`}
      className="flex h-9 items-center rounded-control border border-line bg-white px-3.5 text-sm font-semibold text-brand transition-colors hover:border-brand/40"
    >
      로그인
    </Link>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-9 items-center rounded-control px-3 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
    >
      {pending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
