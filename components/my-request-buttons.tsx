"use client";

import { useFormStatus } from "react-dom";
import { chooseMatch, requestMore } from "@/lib/my-request-actions";

/*
 * 기관 담당자 · 내 의뢰 화면의 버튼. 누르는 동안에는 한 번 더 눌리지 않게 한다.
 */

/** '이 강사님으로 할게요' / '선택 취소' */
export function ChooseButton({ requestId, matchId, chosen }: { requestId: string; matchId: string; chosen: boolean }) {
  return (
    <form
      action={chooseMatch.bind(null, requestId, matchId, !chosen)}
      onSubmit={(e) => {
        if (chosen && !window.confirm("이 강사님 선택을 취소할까요?")) e.preventDefault();
      }}
    >
      <Submit
        idle={chosen ? "선택 취소" : "이 강사님으로 할게요"}
        className={
          chosen
            ? "h-11 bg-bg px-4 text-[14px] text-muted hover:bg-line hover:text-ink"
            : "h-14 w-full bg-brand px-5 text-[16px] text-white hover:bg-brand/90"
        }
      />
    </form>
  );
}

/** '다른 강사를 원해요' + 한 줄 의견 */
export function MoreForm({ requestId }: { requestId: string }) {
  return (
    <form action={requestMore.bind(null, requestId)} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold text-ink">
          원하시는 강사님을 알려 주세요 <span className="font-normal text-muted">(선택)</span>
        </span>
        <textarea
          name="note"
          maxLength={300}
          rows={3}
          placeholder="예: 체험형 수업 경험이 있는 분이면 좋겠어요"
          className="w-full resize-y rounded-control border-2 border-transparent bg-bg px-4 py-3 text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:bg-white"
        />
      </label>
      <Submit idle="다른 강사를 원해요" className="h-14 w-full bg-ink px-5 text-[16px] text-white hover:bg-ink/85" />
    </form>
  );
}

function Submit({ idle, className }: { idle: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex items-center justify-center rounded-control font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? "처리 중…" : idle}
    </button>
  );
}
