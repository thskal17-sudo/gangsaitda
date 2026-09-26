"use client";

import { useFormStatus } from "react-dom";
import { setJobHidden } from "@/lib/admin-job-actions";

/** 공고 관리 목록의 '숨기기 / 다시 올리기' 버튼. 누르는 동안에는 한 번 더 눌리지 않게 한다. */
export default function HideButton({ id, hidden }: { id: string; hidden: boolean }) {
  return (
    <form action={setJobHidden.bind(null, id, !hidden)}>
      <Submit hidden={hidden} />
    </form>
  );
}

function Submit({ hidden }: { hidden: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-9 items-center rounded-control px-3 text-[14px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
        hidden ? "bg-brand/10 text-brand hover:bg-brand/15" : "bg-bg text-muted hover:bg-line hover:text-ink"
      }`}
    >
      {pending ? "처리 중…" : hidden ? "다시 올리기" : "숨기기"}
    </button>
  );
}
