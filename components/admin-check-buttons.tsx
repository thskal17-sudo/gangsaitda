"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckBadge } from "@/components/check-badges";
import type { ProfileCheck } from "@/lib/admin-profiles";
import { setProfileCheck } from "@/lib/admin-check-actions";
import { formatKoreanDate } from "@/lib/date";

/*
 * 관리자 · 강사 줄 안의 '운영자 확인' 칸. 내용을 보고 [확인]을 누르면 배지가 붙고, [확인 취소]로 뗀다.
 * 확인한 뒤 강사가 내용을 바꾸면 '다시 확인'으로 보이고, 다시 [확인]을 누르면 지금 내용으로 붙는다.
 */
export function CheckControl({
  id,
  kind,
  label,
  check,
  disabledReason,
}: {
  id: string;
  kind: "profile" | "plan";
  label: string;
  check?: ProfileCheck;
  /** 확인할 수 없는 이유 (예: 강의계획서를 아직 안 올림). 있으면 버튼 대신 이 문구 */
  disabledReason?: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = check?.status === "확인";

  async function save(checked: boolean) {
    if (!checked && !window.confirm(`'${label}' 배지를 뗄까요?`)) return;
    setBusy(true);
    setError("");
    const result = await setProfileCheck(id, kind, checked, note);
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-control bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <CheckBadge label={label} state={done ? "done" : check ? "stale" : "waiting"} small />
        {check && (
          <span className="nums text-[12px] text-muted">
            {formatKoreanDate(check.date)} 확인{check.note && <> · {check.note}</>}
          </span>
        )}
      </div>
      {disabledReason ? (
        <p className="text-[13px] text-muted">{disabledReason}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {!done && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="무엇을 보고 확인했는지 (선택)"
              aria-label={`${label} 메모`}
              className="h-9 min-w-0 flex-1 rounded-control bg-bg px-3 text-[13px] text-ink placeholder:text-muted"
            />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(!done)}
            className={`flex h-9 items-center rounded-control px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:cursor-wait disabled:opacity-60 ${
              done ? "bg-bg text-muted hover:bg-line hover:text-warn" : "bg-ok text-white hover:bg-ok/90"
            }`}
          >
            {busy ? "처리 중…" : done ? "확인 취소" : check ? "다시 확인" : "확인"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
