"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveMatchFeedback } from "@/lib/my-feedback-actions";

/**
 * 기관 담당자 · 확정된 강사 한 명의 강의 만족도 (별점 1~5 + 다시 부르고 싶은지 + 한 줄 의견).
 * 별점과 '다시 부르고 싶은지'는 다른 기관에 요약으로만 보이고, 한 줄 의견은 운영자만 본다.
 * 이미 남긴 값이 있으면 그 값이 채워져 있고, 저장하면 고쳐진다.
 */
export default function FeedbackForm({
  requestId,
  matchId,
  initial,
}: {
  requestId: string;
  matchId: string;
  initial?: { rating?: number; rehire?: boolean; comment?: string };
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [rehire, setRehire] = useState<"yes" | "no" | "">(initial?.rehire === undefined ? "" : initial.rehire ? "yes" : "no");
  const shown = hover || rating;

  return (
    <form action={saveMatchFeedback.bind(null, requestId, matchId)} className="mt-3 flex flex-col gap-4">
      <input type="hidden" name="rating" value={rating} />
      <input type="hidden" name="rehire" value={rehire} />
      <div role="radiogroup" aria-label="별점" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}점`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className={`text-[34px] leading-none transition-colors ${n <= shown ? "text-accent" : "text-line"}`}
          >
            ★
          </button>
        ))}
        <span className="nums ml-2 text-[14px] font-semibold text-muted">{RATING_TEXT[shown] ?? "별을 눌러 주세요"}</span>
      </div>

      <fieldset>
        <legend className="text-[14px] font-semibold text-ink">다음에도 이 강사님을 부르고 싶으세요?</legend>
        <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["yes", "네, 다시 부를래요"],
              ["no", "아니요"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rehire === value}
              onClick={() => setRehire(value)}
              className={`flex h-12 items-center justify-center rounded-control text-[15px] font-semibold transition-colors ${
                rehire === value ? (value === "yes" ? "bg-ok text-white" : "bg-ink text-white") : "bg-bg text-ink hover:bg-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold text-ink">
          한 줄 의견 <span className="font-normal text-muted">(선택, 운영자만 봐요)</span>
        </span>
        <textarea
          name="comment"
          maxLength={300}
          rows={3}
          defaultValue={initial?.comment ?? ""}
          placeholder="예: 준비를 잘해 오셔서 학생들 반응이 좋았어요."
          className="w-full resize-y rounded-control border-2 border-transparent bg-bg px-4 py-3 text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:bg-white"
        />
      </label>
      <Submit disabled={rating === 0 || rehire === ""} label={initial?.rating ? "만족도 고치기" : "만족도 남기기"} />
    </form>
  );
}

const RATING_TEXT: Record<number, string> = { 1: "아쉬워요", 2: "그저 그래요", 3: "보통이에요", 4: "좋았어요", 5: "아주 좋았어요" };

function Submit({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex h-14 w-full items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "저장 중…" : label}
    </button>
  );
}
