"use client";

import { useFormStatus } from "react-dom";
import { disconnectKakaoAction, sendKakaoTest } from "@/lib/kakao-actions";

/** 관리자 · 카톡 알림 화면의 '시험 메시지 보내기' 버튼 */
export function SendTestButton({ disabled }: { disabled?: boolean }) {
  return (
    <form action={sendKakaoTest}>
      <Submit label="시험 메시지 보내기" pendingLabel="보내는 중…" disabled={disabled} primary />
    </form>
  );
}

/** 관리자 · 카톡 알림 화면의 '연결 끊기' 버튼 */
export function DisconnectButton() {
  return (
    <form action={disconnectKakaoAction}>
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
