"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { reviewPosting } from "@/lib/admin-posting-actions";

/**
 * 관리자 · 모집 공고 승인 / 반려 버튼. 반려는 사유를 꼭 적는다 (담당자 화면에 그대로 보인다).
 * 기관 확인 전에는 승인 버튼이 눌리지 않는다.
 */
export default function PostingReview({ requestId, verified }: { requestId: string; verified: boolean }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {rejecting ? (
        <form action={reviewPosting.bind(null, requestId, false)} className="flex flex-col gap-3 rounded-control bg-bg p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-ink">반려 사유 (담당자에게 그대로 보여요)</span>
            <textarea
              name="note"
              required
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="예: 강사료를 적어 주세요. 수업 대상 학년도 함께 알려 주시면 좋아요."
              className="w-full resize-y rounded-control border-2 border-transparent bg-white px-4 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted/70 focus:border-brand"
            />
          </label>
          <div className="flex gap-2">
            <Submit idle="반려하기" className="bg-warn text-white hover:bg-warn/90" />
            <button type="button" onClick={() => setRejecting(false)} className="h-11 rounded-control bg-white px-4 text-[14px] font-semibold text-muted hover:text-ink">
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2 md:flex-row">
          <form
            action={reviewPosting.bind(null, requestId, true)}
            onSubmit={(e) => {
              if (!window.confirm("이 공고를 승인해 공고 목록에 올릴까요?")) e.preventDefault();
            }}
            className="md:flex-1"
          >
            <Submit idle="승인하고 공고 올리기" className="w-full bg-ok text-white hover:bg-ok/90" disabled={!verified} />
          </form>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="flex h-11 items-center justify-center rounded-control bg-bg px-5 text-[14px] font-semibold text-muted hover:bg-line hover:text-warn"
          >
            반려 (사유 적기)
          </button>
        </div>
      )}
      {!verified && <p className="text-[13px] text-warn">① 기관 확인을 먼저 해 주세요. 확인 전에는 승인할 수 없어요.</p>}
    </div>
  );
}

function Submit({ idle, className, disabled }: { idle: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`flex h-11 items-center justify-center rounded-control px-5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {pending ? "처리 중…" : idle}
    </button>
  );
}
