"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addMatch,
  preparePlanUpload,
  removeMatch,
  removePlan,
  savePlan,
  setMatchStatus,
  setRequestVerified,
} from "@/lib/admin-match-actions";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/match-status";
import { REQUEST_FILE_ACCEPT, REQUEST_FILE_MAX_BYTES, requestFileExtension } from "@/lib/request-files";

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

/**
 * 강의계획서: 올리기 / 내려받기 / 바꾸기 / 지우기. 추천 강사 줄마다 하나.
 * 파일은 브라우저가 저장소에 바로 올리고(사이트 서버를 거치지 않음), 다 올라가면 표에 적는다.
 */
export function PlanUpload({ requestId, matchId, planName }: { requestId: string; matchId: string; planName?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (!requestFileExtension(file.name)) return setError("PDF, 한글, 워드, 파워포인트, 사진(JPG·PNG) 파일만 올릴 수 있어요.");
    if (file.size > REQUEST_FILE_MAX_BYTES) return setError("파일은 10MB 까지 올릴 수 있어요.");
    setBusy(true);
    try {
      const ticket = await preparePlanUpload(requestId, matchId, file.name, file.size);
      if ("error" in ticket) return setError(ticket.error);
      const res = await fetch(ticket.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
        body: file,
      });
      if (!res.ok) return setError("파일을 올리지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
      const saved = await savePlan(requestId, matchId, ticket.path, file.name);
      if ("error" in saved) return setError(saved.error);
      router.refresh();
    } catch {
      setError("파일을 올리지 못했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-control bg-bg px-3 py-2 text-[14px]">
        <span className="font-semibold text-muted">강의계획서</span>
        {planName ? (
          <a
            href={`/admin/requests/${requestId}/plan/${matchId}`}
            className="min-w-0 max-w-[260px] truncate font-semibold text-brand hover:underline"
          >
            {planName}
          </a>
        ) : (
          <span className="text-muted">아직 없음</span>
        )}
        <input
          ref={input}
          type="file"
          accept={REQUEST_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="flex h-8 items-center rounded-control bg-white px-3 text-[13px] font-semibold text-brand hover:bg-brand/10 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "올리는 중…" : planName ? "바꾸기" : "올리기"}
          </button>
          {planName && !busy && (
            <form
              action={removePlan.bind(null, requestId, matchId)}
              onSubmit={(e) => {
                if (!window.confirm("강의계획서를 지울까요?")) e.preventDefault();
              }}
            >
              <button type="submit" className="flex h-8 items-center rounded-control px-2.5 text-[13px] font-semibold text-muted hover:text-warn">
                지우기
              </button>
            </form>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
