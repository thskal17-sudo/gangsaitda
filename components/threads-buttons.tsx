"use client";

import { useFormStatus } from "react-dom";
import { checkThreadsAction, disconnectThreadsAction } from "@/lib/threads-actions";

/** 관리자 · Threads 자동 게시 화면의 '연결 확인' 버튼 (글은 올리지 않음) */
export function CheckButton({ disabled }: { disabled?: boolean }) {
  return (
    <form action={checkThreadsAction}>
      <Submit label="연결 확인" pendingLabel="확인하는 중…" disabled={disabled} primary />
    </form>
  );
}

/** 관리자 · Threads 자동 게시 화면의 '연결 끊기' 버튼 */
export function DisconnectButton() {
  return (
    <form action={disconnectThreadsAction}>
      <Submit label="연결 끊기" pendingLabel="끊는 중…" />
    </form>
  );
}

function Submit({ label, pendingLabel, disabled, primary }: { label: string; pendingLabel: string; disabled?: boolean; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`flex h-12 items-center justify-center rounded-control px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? "bg-brand text-white hover:bg-brand/90" : "bg-bg text-ink hover:bg-line"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
