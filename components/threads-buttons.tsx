"use client";

import { useFormStatus } from "react-dom";
import { checkThreadsAction, disconnectThreadsAction, saveThreadsKeysAction } from "@/lib/threads-actions";

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

/**
 * 관리자 · Threads 앱 ID·시크릿 입력 칸. 시크릿은 저장된 값을 다시 보여주지 않는다 (새로 넣을 때만 입력).
 */
export function AppKeysForm({ savedAppId }: { savedAppId: string | null }) {
  return (
    <form action={saveThreadsKeysAction} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-medium text-ink">Threads 앱 ID</span>
        <input
          name="appId"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={savedAppId ?? ""}
          placeholder="예) 1421076040227380"
          required
          className="h-14 rounded-control bg-bg px-4 text-[16px] tabular-nums outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-medium text-ink">Threads 앱 시크릿 코드</span>
        <input
          name="appSecret"
          type="password"
          autoComplete="new-password"
          placeholder={savedAppId ? "저장돼 있어요. 바꿀 때만 다시 넣어 주세요" : "Meta 화면에서 '보기'를 눌러 나온 값"}
          required
          className="h-14 rounded-control bg-bg px-4 text-[16px] outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
      <div>
        <Submit label="저장" pendingLabel="저장하는 중…" primary />
      </div>
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
