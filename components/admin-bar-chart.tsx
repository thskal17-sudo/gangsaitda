/** 막대 하나 */
export type Bar = {
  key: string;
  value: number;
  /** 막대에 손가락·마우스를 올렸을 때 보이는 글. 예: "10월 29일(목) 12회" */
  tooltip: string;
  /** 막대 아래 글. 비우면 그 자리는 빈칸 (막대가 많을 때 듬성듬성 적으려고) */
  axisLabel?: string;
  /** 오늘(지금 기간) 막대는 진하게 */
  current?: boolean;
};

/**
 * 관리자 현황의 막대그래프. 남색 한 가지 색, 지금 기간만 진하게.
 * 막대에 손가락·마우스를 올리거나 키보드로 고르면 숫자가 보인다.
 */
export default function AdminBarChart({ bars, label }: { bars: Bar[]; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  // 막대가 많으면 사이 간격을 줄여 휴대폰 폭에도 들어가게 한다.
  const gap = bars.length > 20 ? "gap-[2px]" : "gap-1 md:gap-2";

  return (
    <>
      <ul className={`mt-10 flex h-40 items-end border-b border-line ${gap}`} aria-label={label}>
        {bars.map((b, i) => (
          <li key={b.key} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end outline-none">
            <span
              className={`w-full rounded-t-[4px] ${b.current ? "bg-brand" : "bg-brand/55"} group-hover:bg-brand group-focus:bg-brand`}
              style={{ height: b.value > 0 ? `max(3px, ${(b.value / max) * 100}%)` : 0 }}
            />
            <span
              role="tooltip"
              className={`nums pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap ${tooltipPosition(i, bars.length)} rounded-control bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white group-hover:block group-focus:block`}
            >
              {b.tooltip}
            </span>
            <span className="sr-only">{b.tooltip}</span>
          </li>
        ))}
      </ul>
      <div className={`nums mt-2 flex text-center text-[11px] text-muted ${gap}`} aria-hidden="true">
        {bars.map((b) => (
          // 글이 막대보다 넓어도 옆 칸으로 넘쳐 보이게 (막대가 많을 때)
          <span key={b.key} className={`flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap ${b.current ? "font-bold text-ink" : ""}`}>
            {b.axisLabel ?? ""}
          </span>
        ))}
      </div>
    </>
  );
}

/** 숫자 풍선이 그래프 밖으로 잘리지 않게: 왼쪽 끝 막대는 왼쪽에 맞추고, 오른쪽 끝 막대는 오른쪽에 맞춘다. */
function tooltipPosition(index: number, count: number): string {
  if (index < count / 4) return "left-0";
  if (index >= (count * 3) / 4) return "right-0";
  return "left-1/2 -translate-x-1/2";
}
