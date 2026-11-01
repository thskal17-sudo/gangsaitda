/*
 * 운영자 확인 배지 ('프로필 확인', '강의계획서 확인'). 기관 화면·관리자 화면·내 프로필이 함께 쓴다.
 * 운영자가 내용을 직접 확인했다는 표시이고, 강의 품질을 보증한다는 뜻은 아니다 (supabase/profile-badges.sql).
 */

export const CHECK_BADGE_HELP = "강사잇다 운영자가 내용을 직접 확인한 항목이에요.";

/**
 * 배지 하나. done = 배지 붙음(초록), waiting = 아직 확인 전(회색), stale = 확인한 뒤 내용이 바뀜(주황, 관리자 화면용)
 */
export function CheckBadge({
  label,
  state = "done",
  small = false,
}: {
  label: string;
  state?: "done" | "waiting" | "stale";
  small?: boolean;
}) {
  const color =
    state === "done" ? "bg-ok/10 text-ok" : state === "stale" ? "bg-accent/10 text-accent" : "bg-bg text-muted";
  const text = state === "done" ? `✓ ${label}` : state === "stale" ? `${label} · 다시 확인` : `${label} 대기`;
  return (
    <span
      title={state === "done" ? CHECK_BADGE_HELP : undefined}
      className={`whitespace-nowrap rounded-badge font-semibold ${color} ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[12px]"}`}
    >
      {text}
    </span>
  );
}
