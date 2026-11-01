"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setJobSaved } from "@/lib/saved-jobs-actions";

/**
 * 관심 공고 담기 별 버튼. 누르면 바로 별이 바뀌고(먼저 보여 주기), 저장에 실패하면 되돌린다.
 * - small: 공고 목록 카드 오른쪽 아래 (별만)
 * - large: 공고 상세 (별 + "관심 공고 담기" 글자)
 * 비회원에게는 같은 모양의 '로그인하러 가기' 링크를 보여 준다 (loginNext = 로그인 뒤 돌아올 주소).
 */
export default function SaveJobButton({
  jobId,
  saved,
  size,
  loginNext,
}: {
  jobId: string;
  saved: boolean;
  size: "small" | "large";
  loginNext?: string;
}) {
  const [on, setOn] = useState(saved);
  const [pending, startTransition] = useTransition();

  const label = on ? "관심 공고에서 빼기" : "관심 공고 담기";
  const className =
    size === "small"
      ? `flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-bg ${on ? "text-accent" : "text-muted"}`
      : `flex h-11 items-center gap-1.5 rounded-control px-4 text-[15px] font-semibold transition-colors ${
          on ? "bg-accent/10 text-accent hover:bg-accent/15" : "bg-bg text-ink hover:bg-line"
        }`;
  const content = (
    <>
      <StarIcon filled={on} />
      {size === "large" && <span>{on ? "관심 공고에 담았어요" : "관심 공고 담기"}</span>}
    </>
  );

  if (loginNext) {
    return (
      <Link href={`/login?next=${encodeURIComponent(loginNext)}`} aria-label="로그인하고 관심 공고 담기" className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
          const result = await setJobSaved(jobId, next);
          if ("error" in result) {
            setOn(!next);
            alert(result.error);
          }
        });
      }}
      className={`${className} disabled:cursor-wait`}
    >
      {content}
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}
