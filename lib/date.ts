/**
 * 날짜 도우미. 날짜는 모두 한국 날짜 기준 "2026-09-25" 형태의 글자로 다룬다.
 * 서버가 어느 나라 시간대에서 돌든 한국 날짜로 계산되게 하려는 것.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 UTC+9, 서머타임 없음
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toUtcMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** 지금 한국 날짜. 예: "2026-09-23" */
export function todayInSeoul(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** date 에서 days 일 뒤의 날짜 */
export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** from 부터 to 까지 남은 날 수. 같은 날이면 0 */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** "2026-09-25" → "9월 25일(금)" */
export function formatKoreanDate(date: string): string {
  const d = new Date(toUtcMs(date));
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAYS[d.getUTCDay()]})`;
}
