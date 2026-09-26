"use client";

import { useFormStatus } from "react-dom";
import { setRequestStatus } from "@/lib/admin-request-actions";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/request-status";

/** 의뢰 카드 아래의 처리 상태 버튼 (접수 · 처리 중 · 완료). 지금 상태가 칠해져 있고, 다른 상태를 누르면 바뀐다. */
export default function RequestStatusButtons({ id, status }: { id: string; status: RequestStatus }) {
  return (
    <div role="group" aria-label="처리 상태 바꾸기" className="flex gap-1 rounded-control bg-bg p-1">
      {REQUEST_STATUSES.map((s) => (
        <form key={s} action={setRequestStatus.bind(null, id, s)} className="flex-1">
          <StatusButton label={s} current={s === status} />
        </form>
      ))}
    </div>
  );
}

function StatusButton({ label, current }: { label: RequestStatus; current: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={current || pending}
      aria-pressed={current}
      className={`flex h-10 w-full items-center justify-center rounded-[10px] text-[14px] font-semibold transition-colors ${
        current ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink disabled:cursor-wait disabled:opacity-60"
      }`}
    >
      {pending ? "바꾸는 중…" : label}
    </button>
  );
}
