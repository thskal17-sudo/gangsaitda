"use client";

import { useFormStatus } from "react-dom";
import { logoutToHome } from "@/lib/auth-actions";

/** 마이페이지 맨 아래 '로그아웃' 줄. 누르면 로그아웃하고 홈으로 간다. */
export default function LogoutRow() {
  return (
    <form action={logoutToHome}>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-[56px] w-full items-center px-5 text-left text-[16px] font-semibold text-muted transition-colors hover:bg-bg/60 hover:text-ink disabled:cursor-wait"
    >
      {pending ? "로그아웃하는 중…" : "로그아웃"}
    </button>
  );
}
