"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type DraftKeyState,
  checkThreadsAction,
  createDraftKeyAction,
  discardThreadsDraftAction,
  disconnectThreadsAction,
  postThreadsDraftAction,
  retryFailedThreadsAction,
  saveThreadsKeysAction,
} from "@/lib/threads-actions";

/** Threads 글 최대 글자 수 (lib/threads.ts 의 THREADS_DRAFT_MAX 와 같은 값. 이 파일은 브라우저에서 돌아서 서버 파일을 부르지 않는다) */
const DRAFT_MAX = 500;

/** 관리자 · Threads 자동 게시 화면의 '연결 확인' 버튼 (글은 올리지 않음) */
export function CheckButton({ disabled }: { disabled?: boolean }) {
  return (
    <form action={checkThreadsAction}>
      <Submit label="연결 확인" pendingLabel="확인하는 중…" disabled={disabled} primary />
    </form>
  );
}

/** 관리자 · '실패한 공고 다시 올리기' 버튼. 누르면 실패한 공고를 글 하나로 묶어 바로 올린다. */
export function RetryFailedButton({ count, disabled }: { count: number; disabled?: boolean }) {
  return (
    <form action={retryFailedThreadsAction}>
      <Submit label={`실패한 공고 다시 올리기 (${count}건)`} pendingLabel="올리는 중… (10초쯤 걸려요)" disabled={disabled} primary />
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

/**
 * 관리자 · '올릴 글' 카드 하나. 글을 고칠 수 있고, [올리기]를 누르면 고친 글 그대로 Threads 에 올라간다.
 * [버리기]는 올리지 않고 목록에서 치운다. canPost=false(연결 안 됨·만료)면 [올리기]를 막는다.
 */
export function DraftCard({ id, initialBody, canPost, posting }: { id: number; initialBody: string; canPost: boolean; posting: boolean }) {
  const [body, setBody] = useState(initialBody);
  const length = body.trim().length;
  const tooLong = length > DRAFT_MAX;
  return (
    <form className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={11}
        disabled={posting}
        aria-label="올릴 글 내용"
        className="w-full resize-y rounded-control bg-bg px-4 py-3 text-[16px] leading-relaxed outline-none [word-break:keep-all] focus:ring-2 focus:ring-brand disabled:opacity-60"
      />
      <p className={`text-right text-[13px] tabular-nums ${tooLong ? "font-semibold text-warn" : "text-muted"}`}>
        {length} / {DRAFT_MAX}자{tooLong ? " — 줄여 주세요" : ""}
      </p>
      <div className="flex gap-2">
        {!posting && (
          <Submit
            label="올리기"
            pendingLabel="올리는 중… (10초쯤 걸려요)"
            disabled={!canPost || tooLong || length === 0}
            primary
            wide
            formAction={postThreadsDraftAction}
          />
        )}
        <Submit label="버리기" pendingLabel="치우는 중…" formAction={discardThreadsDraftAction} />
      </div>
    </form>
  );
}

/**
 * 관리자 · 받는 문 열쇠. [받는 문 열쇠 만들기]를 누르면 새 열쇠를 이 화면에 한 번만 보여준다.
 * 이미 있으면 [새 열쇠로 바꾸기] (누르기 전에 확인을 묻는다. 바꾸면 이전 열쇠는 바로 못 쓴다).
 */
export function DraftKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, action] = useActionState<DraftKeyState, FormData>(createDraftKeyAction, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      {state.token ? (
        <div className="rounded-control bg-ok/10 px-4 py-3">
          <p className="text-[14px] font-semibold text-ok">새 열쇠를 만들었어요. 이 화면을 벗어나면 다시 볼 수 없어요.</p>
          <p className="mt-2 select-all break-all rounded-control bg-white px-3 py-2 font-mono text-[15px] tabular-nums">{state.token}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(state.token ?? "").then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-control bg-brand text-[15px] font-semibold text-white hover:bg-brand/90"
          >
            {copied ? "복사했어요" : "열쇠 복사"}
          </button>
          <p className="mt-2 text-[13px] text-muted">복사한 열쇠를 홍보 담당(Claude) 예약 작업에 알려 주세요. 다른 사람에게는 보여 주지 마세요.</p>
        </div>
      ) : (
        <form
          action={action}
          onSubmit={(e) => {
            if (hasKey && !window.confirm("새 열쇠로 바꿀까요? 지금 쓰는 열쇠는 바로 못 쓰게 돼요.")) e.preventDefault();
          }}
        >
          <Submit label={hasKey ? "새 열쇠로 바꾸기" : "받는 문 열쇠 만들기"} pendingLabel="만드는 중…" primary={!hasKey} />
        </form>
      )}
      {state.error && <p className="mt-2 text-[13px] text-warn">{state.error}</p>}
    </div>
  );
}

function Submit({
  label,
  pendingLabel,
  disabled,
  primary,
  wide,
  formAction,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  primary?: boolean;
  /** 남은 너비를 채운다 (올릴 글의 [올리기]) */
  wide?: boolean;
  /** 한 폼 안에 버튼이 둘일 때, 이 버튼이 부를 동작 */
  formAction?: (formData: FormData) => Promise<void>;
}) {
  const { pending, action } = useFormStatus();
  // 한 폼에 버튼이 둘이면, 누른 버튼에만 '…하는 중'을 보여준다 (둘 다 잠그기는 한다)
  const mine = pending && (!formAction || action === formAction);
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={disabled || pending}
      className={`flex h-12 items-center justify-center rounded-control px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${wide ? "flex-1" : ""} ${
        primary ? "bg-brand text-white hover:bg-brand/90" : "bg-bg text-ink hover:bg-line"
      }`}
    >
      {mine ? pendingLabel : label}
    </button>
  );
}
