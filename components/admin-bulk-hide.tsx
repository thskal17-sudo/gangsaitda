"use client";

import { type ReactNode, useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { type BulkHiddenState, setJobsHidden } from "@/lib/admin-job-actions";

/**
 * 공고 관리 목록 · 한꺼번에 숨기기 / 다시 올리기.
 * 목록(children) 안의 체크박스(name="id", form={formId})를 세고, 위쪽 막대에서 전체 선택·실행을 한다.
 * 체크박스는 줄마다 있는 '숨기기' 양식 안에 넣을 수 없어서(양식 안에 양식 불가) form 속성으로 이 양식에 잇는다.
 * 실행 전에 한 번 더 묻고, 끝나면 결과를 띄우고 체크를 모두 푼다.
 */
export default function AdminBulkHide({ formId, total, children }: { formId: string; total: number; children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  const boxes = () => Array.from(listRef.current?.querySelectorAll<HTMLInputElement>('input[name="id"]') ?? []);
  const recount = () => setCount(boxes().filter((b) => b.checked).length);
  const setAll = (checked: boolean) => {
    for (const b of boxes()) b.checked = checked;
    recount();
  };

  // 실행이 끝나면 결과를 남기고 체크를 모두 푼다
  const [state, action] = useActionState<BulkHiddenState, FormData>(async (prev, formData) => {
    const result = await setJobsHidden(prev, formData);
    setAll(false);
    return result;
  }, null);

  const allChecked = total > 0 && count === total;

  return (
    <>
      <form
        id={formId}
        hidden={total === 0}
        action={action}
        onSubmit={(e) => {
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const verb = submitter?.value === "show" ? "다시 올릴까요" : "숨길까요";
          if (!window.confirm(`고른 공고 ${count}개를 ${verb}?`)) e.preventDefault();
        }}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-control bg-bg px-3 py-2"
      >
        <label className="flex h-9 cursor-pointer items-center gap-2 pr-2 text-[14px] font-semibold text-ink">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => setAll(e.target.checked)}
            disabled={total === 0}
            className="size-[18px] accent-brand"
          />
          전체 선택
        </label>
        <span className="nums text-[14px] text-muted">
          <span className="font-semibold text-ink">{count}</span>개 골랐어요
        </span>
        <div className="ml-auto flex gap-2">
          <BulkButton mode="hide" disabled={count === 0} />
          <BulkButton mode="show" disabled={count === 0} />
        </div>
      </form>

      {state && <Result state={state} />}

      <div ref={listRef} onChange={recount}>
        {children}
      </div>
    </>
  );
}

function BulkButton({ mode, disabled }: { mode: "hide" | "show"; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="mode"
      value={mode}
      disabled={disabled || pending}
      className={`flex h-9 items-center rounded-control px-3.5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        mode === "hide" ? "bg-ink text-white hover:bg-ink/85" : "bg-white text-brand hover:bg-brand/10"
      }`}
    >
      {pending ? "처리 중…" : mode === "hide" ? "선택 숨기기" : "선택 다시 올리기"}
    </button>
  );
}

function Result({ state }: { state: NonNullable<BulkHiddenState> }) {
  const verb = state.hidden ? "숨겼어요" : "다시 올렸어요";
  const ok = !state.error && state.failed === 0;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`mt-3 rounded-control px-4 py-3 text-[14px] font-semibold ${ok ? "bg-ok/10 text-ok" : "bg-warn/8 text-warn"}`}
    >
      {state.error ??
        (state.failed === 0
          ? `공고 ${state.done}개를 ${verb}.`
          : `${state.done}개는 ${verb}. ${state.failed}개는 하지 못했어요. 잠시 뒤에 다시 시도해 주세요.`)}
    </p>
  );
}
