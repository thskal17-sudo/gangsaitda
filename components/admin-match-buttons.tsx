"use client";

import { useFormStatus } from "react-dom";
import { addMatch, removeMatch, setMatchStatus, setRequestVerified } from "@/lib/admin-match-actions";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/match-status";

/*
 * 관리자 · 의뢰 상세 화면의 버튼들. 누르는 동안에는 한 번 더 눌리지 않게 한다.
 */

/** 기관 확인됨 표시 / 취소 */
export function VerifyButton({ requestId, verified }: { requestId: string; verified: boolean }) {
  return (
    <form action={setRequestVerified.bind(null, requestId, !verified)}>
      <Pending
        idle={verified ? "확인 취소" : "기관 확인됨으로 표시"}
        className={verified ? "bg-bg text-muted hover:bg-line hover:text-ink" : "bg-ok text-white hover:bg-ok/90"}
      />
    </form>
  );
}

/** 강사 고르기 목록의 '추천하기' */
export function AddMatchButton({ requestId, memberId }: { requestId: string; memberId: string }) {
  return (
    <form action={addMatch.bind(null, requestId, memberId)}>
      <Pending idle="추천하기" className="bg-brand text-white hover:bg-brand/90" />
    </form>
  );
}

/** 추천 강사에서 빼기 */
export function RemoveMatchButton({ requestId, matchId, name }: { requestId: string; matchId: string; name: string }) {
  return (
    <form
      action={removeMatch.bind(null, requestId, matchId)}
      onSubmit={(e) => {
        if (!window.confirm(`${name} 강사님을 이 의뢰의 추천에서 뺄까요? (프로필은 그대로예요)`)) e.preventDefault();
      }}
    >
      <Pending idle="빼기" className="bg-bg text-muted hover:bg-line hover:text-warn" />
    </form>
  );
}

/** 진행 상태: 추천 · 검토 중 · 연락 중 · 확정 · 불발. 지금 상태가 칠해져 있고, 다른 상태를 누르면 바뀐다. */
export function MatchStatusButtons({ requestId, matchId, status }: { requestId: string; matchId: string; status: MatchStatus }) {
  return (
    <div role="group" aria-label="진행 상태 바꾸기" className="flex gap-1 overflow-x-auto rounded-control bg-bg p-1">
      {MATCH_STATUSES.map((s) => (
        <form key={s} action={setMatchStatus.bind(null, requestId, matchId, s)} className="flex-1">
          <StatusButton label={s} current={s === status} />
        </form>
      ))}
    </div>
  );
}

function StatusButton({ label, current }: { label: MatchStatus; current: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={current || pending}
      aria-pressed={current}
      className={`flex h-9 w-full items-center justify-center rounded-[10px] px-2 text-[13px] font-semibold whitespace-nowrap transition-colors ${
        current
          ? label === "확정"
            ? "bg-ok text-white"
            : "bg-white text-ink shadow-sm"
          : "text-muted hover:text-ink disabled:cursor-wait disabled:opacity-60"
      }`}
    >
      {pending ? "…" : label}
    </button>
  );
}

function Pending({ idle, className }: { idle: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-9 items-center rounded-control px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? "처리 중…" : idle}
    </button>
  );
}
