/*
 * 강사잇다 평가 요약 한 줄: "강사잇다 평가 3건 · ★ 4.7 · 다시 부르고 싶다 100%".
 * 기관 화면의 추천 강사 카드와 관리자 강사 줄이 함께 쓴다 (supabase/match-feedback.sql).
 * 다른 기관에는 이 요약만 보이고, 한 줄 의견은 운영자만 본다. 평가가 없으면 아무것도 그리지 않는다.
 */
export default function ReviewSummary({
  count,
  average,
  rehirePercent,
  small = false,
}: {
  count: number;
  average?: number;
  rehirePercent?: number;
  small?: boolean;
}) {
  if (count <= 0 || average === undefined) return null;
  return (
    <span
      className={`nums inline-flex flex-wrap items-center gap-x-1.5 rounded-badge bg-accent/10 font-semibold text-ink ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]"
      }`}
    >
      <span className="text-muted">강사잇다 평가 {count}건</span>
      <span className="text-accent">★ {average.toFixed(1)}</span>
      {rehirePercent !== undefined && <span>다시 부르고 싶다 {rehirePercent}%</span>}
    </span>
  );
}
