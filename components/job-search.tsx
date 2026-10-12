import Link from "next/link";

/**
 * 공고 검색칸. 단어를 넣고 검색하면 주소에 ?q=검색어 가 붙어 그 공고만 보인다 (lib/job-search.ts).
 * 자바스크립트 없이 동작하는 보통 양식(GET)이라, 뒤로가기·주소 공유가 된다.
 * 검색 중이면 오른쪽에 '지우기' 가 나오고, 누르면 검색어만 뗀 주소로 간다.
 */
export default function JobSearch({
  query,
  basePath,
  keepParams = {},
}: {
  /** 지금 검색어. 없으면 "" */
  query: string;
  /** 검색 결과를 보여줄 화면 (예: "/jobs") */
  basePath: string;
  /** 같이 남겨야 하는 주소 값 (예: { region: "부산" }) */
  keepParams?: Record<string, string>;
}) {
  const keep = Object.entries(keepParams).filter(([, v]) => v);
  const clearQuery = new URLSearchParams(Object.fromEntries(keep)).toString();
  const clearHref = clearQuery ? `${basePath}?${clearQuery}` : basePath;

  return (
    <form action={basePath} method="get" role="search" className="relative">
      {keep.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="공고 제목, 기관, 지역으로 찾기"
        aria-label="공고 검색"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={50}
        className="block h-12 w-full rounded-control border-2 border-transparent bg-white pr-20 pl-11 text-[16px] text-ink transition-colors outline-none placeholder:text-muted/70 focus:border-brand md:h-14"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {query && (
          <Link
            href={clearHref}
            className="flex h-8 items-center rounded-badge px-2.5 text-[13px] font-semibold text-muted hover:bg-bg"
          >
            지우기
          </Link>
        )}
        <button
          type="submit"
          className="flex h-8 items-center rounded-badge bg-brand px-3 text-[13px] font-bold text-white hover:bg-brand/90"
        >
          검색
        </button>
      </div>
    </form>
  );
}
