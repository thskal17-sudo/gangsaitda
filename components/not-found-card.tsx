import Link from "next/link";

type Action = { href: string; label: string };

/** '찾을 수 없어요' 안내 카드. 없는 주소, 없는 공고 화면이 함께 쓴다. */
export default function NotFoundCard({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description: string;
  primary: Action;
  secondary?: Action;
}) {
  return (
    <section className="mx-auto w-full max-w-[560px] rounded-card bg-white px-6 py-10 text-center md:px-10 md:py-14">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-badge bg-bg text-muted">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5M8.5 11h5" />
        </svg>
      </span>
      <h1 className="mt-4 text-[22px] font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
      <div className="mx-auto mt-7 flex max-w-sm flex-col gap-3 sm:flex-row">
        <Link
          href={primary.href}
          className="flex h-14 items-center justify-center rounded-control bg-brand sm:flex-1 text-[16px] font-semibold text-white transition-colors hover:bg-brand/90"
        >
          {primary.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            className="flex h-14 items-center justify-center rounded-control bg-bg sm:flex-1 text-[16px] font-semibold text-ink transition-colors hover:bg-line"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}
