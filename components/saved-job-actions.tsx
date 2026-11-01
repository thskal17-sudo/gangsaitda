"use client";

import { useTransition } from "react";
import { removeSavedJob, setSavedJobApplied } from "@/lib/saved-jobs-actions";

/**
 * 관심 공고 한 줄의 버튼: [지원했어요] ↔ [지원 취소], [빼기].
 * '지원했어요'는 강사 본인의 기록일 뿐 기관에 전달되지 않는다. 누르면 목록을 다시 그린다.
 */
export default function SavedJobActions({ jobId, applied }: { jobId: string; applied: boolean }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { error: string }>) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) alert(result.error);
    });
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setSavedJobApplied(jobId, !applied))}
        className={`flex h-11 flex-1 items-center justify-center rounded-control text-[15px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
          applied ? "bg-bg text-muted hover:bg-line" : "bg-brand text-white hover:bg-brand/90"
        }`}
      >
        {applied ? "지원 표시 취소" : "지원했어요"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("관심 공고에서 뺄까요?")) run(() => removeSavedJob(jobId));
        }}
        className="flex h-11 items-center justify-center rounded-control bg-bg px-4 text-[15px] font-semibold text-muted transition-colors hover:bg-line hover:text-ink disabled:cursor-wait disabled:opacity-60"
      >
        빼기
      </button>
    </div>
  );
}
