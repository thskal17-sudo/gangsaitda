import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { JobDetail } from "@/lib/jobs";

/* 공고 상세 화면을 이루는 조각들. */

export type Fact = { label: string; value?: string | number };

/** 이름표 + 값 목록. 값이 비어 있는 줄은 보여주지 않는다. */
export function FactList({ facts }: { facts: Fact[] }) {
  const shown = facts.filter((fact) => fact.value !== undefined && fact.value !== "");

  return (
    <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
      {shown.map((fact) => (
        <Fragment key={fact.label}>
          <dt className="text-muted">{fact.label}</dt>
          <dd className="nums font-medium text-ink">{fact.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** 제목이 있는 흰 카드 한 칸 (상세 내용, 지원 자격 등). */
export function TextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-5 md:p-6">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <div className="mt-2.5 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/** 한 줄에 하나씩 적은 글을 점 목록으로 보여준다. */
export function LineList({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <ul className="list-disc space-y-1 pl-5 marker:text-muted">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

type ApplyAction = { key: string; href: string; label: string; note: string; external?: boolean };

/** 지원 방법 버튼들. 지원서 링크 → 이메일 → 전화 순서이고, 맨 앞의 것을 가장 눈에 띄게 한다. */
export function ApplyActions({ job }: { job: JobDetail }) {
  const actions: ApplyAction[] = [];

  // 운영자가 입력한 값이라도 http(s) 주소만 링크로 만든다 (엉뚱한 스크립트 주소 방지).
  if (job.applyUrl && /^https?:\/\//i.test(job.applyUrl)) {
    actions.push({
      key: "url",
      href: job.applyUrl,
      label: "지원서 작성하러 가기",
      note: "기관 사이트로 이동합니다",
      external: true,
    });
  }
  if (job.applyEmail) {
    const subject = encodeURIComponent(`[강사잇다] ${job.title} 지원`);
    actions.push({
      key: "email",
      href: `mailto:${job.applyEmail}?subject=${subject}`,
      label: "이메일로 지원하기",
      note: job.applyEmail,
    });
  }
  if (job.applyPhone) {
    actions.push({
      key: "phone",
      href: `tel:${job.applyPhone.replace(/[^0-9+]/g, "")}`,
      label: "전화로 문의하기",
      note: job.applyPhone,
    });
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <h2 className="text-sm font-bold text-ink">지원 방법</h2>
      {job.documents && <p className="mt-1.5 text-sm text-muted">제출 서류: {job.documents}</p>}

      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">지원 방법은 기관에 문의해 주세요.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {actions.map((action, index) => (
            <li key={action.key}>
              <a
                href={action.href}
                {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`flex h-12 items-center justify-center rounded-control text-[15px] font-semibold transition-colors ${
                  index === 0
                    ? "bg-brand text-white hover:bg-brand/90"
                    : "border border-line bg-white text-ink hover:border-brand/40"
                }`}
              >
                {action.label}
              </a>
              <p className="nums mt-1 text-center text-xs break-all text-muted">{action.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 원문 공고 링크. 새 창으로 열린다. 운영자가 입력한 값이라도 http(s) 주소만 링크로 만든다. */
export function SourceLink({ url }: { url?: string }) {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand underline-offset-2 hover:underline"
    >
      원문 공고 보기
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}

/** 마감이 지난 공고에서 지원 버튼 대신 보여준다. */
export function ClosedNotice() {
  return (
    <p className="mt-5 rounded-control bg-bg px-4 py-3 text-center text-sm font-semibold text-muted">
      마감된 공고입니다
    </p>
  );
}

/** 비회원에게 상세 내용 대신 보여주는 안내. 가입·로그인 뒤 이 공고로 돌아오게 한다. */
export function MembersOnlyNotice({ next }: { next: string }) {
  const query = `?next=${encodeURIComponent(next)}`;

  return (
    <section className="rounded-card border border-line bg-white p-6 text-center md:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-badge bg-brand/12 text-brand">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">회원만 볼 수 있는 내용입니다</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        기관, 지역, 마감일, 강사료, 수업 일정, 지원 방법, 원문 공고는 회원가입 후 볼 수 있습니다.
        <br />
        가입은 무료입니다.
      </p>
      <Link
        href={`/signup${query}`}
        className="mx-auto mt-5 flex h-12 w-full max-w-xs items-center justify-center rounded-control bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand/90"
      >
        무료 회원가입하고 자세히 보기
      </Link>
      <p className="mt-3 text-sm text-muted">
        이미 회원이세요?{" "}
        <Link href={`/login${query}`} className="font-semibold text-brand underline-offset-2 hover:underline">
          로그인
        </Link>
      </p>
    </section>
  );
}
