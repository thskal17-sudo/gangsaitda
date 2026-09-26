export default function HomePage() {
  return (
    <section>
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">홈</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        아직 비어 있는 화면입니다. 지금은 메뉴가 제대로 움직이는지 확인하는 단계입니다.
      </p>

      {/* 확인용 블록 — 색·글꼴이 제대로 적용됐는지 눈으로 보기 위한 임시 영역.
          홈 화면 내용을 실제로 만들 때 지운다. */}
      <div className="mt-5 rounded-card bg-white p-5 md:max-w-md">
        <p className="text-xs font-semibold tracking-wide text-muted">확인용</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-badge bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
            마감임박
          </span>
          <span className="rounded-badge bg-bg px-2.5 py-1 text-[11px] font-semibold text-muted">
            배지
          </span>
        </div>
        <button
          type="button"
          className="mt-4 h-14 w-full rounded-control bg-brand text-[16px] font-semibold text-white"
        >
          파란색 버튼
        </button>
        <p className="nums mt-3 text-sm text-muted">숫자 확인 1234567890</p>
      </div>
    </section>
  );
}
