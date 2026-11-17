/*
 * Supabase 는 한 번에 1,000줄까지만 돌려준다 (API 설정 'Max rows', 기본 1000).
 * 그보다 많아질 수 있는 목록은 1,000줄씩 나눠 끝까지 읽는다.
 *
 * 2026-11-17: 공고가 1,000건을 넘자 받는 문(lib/job-import.ts)이 '이미 있는 공고'를 1,000건만 읽어
 * 그 뒤에 올라간 공고를 없는 것으로 보고, 브리핑이 돌 때마다 같은 공고를 또 만들었다 (엄궁초 공고 15건).
 */

/** 한 번에 읽는 줄 수. Supabase 의 Max rows(1000)보다 크면 안 된다. */
export const PAGE_ROWS = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/**
 * page(from, to) 로 from~to 번째 줄(0부터, to 포함)을 읽는 함수를 받아, 끝까지 이어 읽는다.
 * 쪽이 바뀌는 사이에 줄이 섞이지 않게, page 쪽 질의는 꼭 정렬(order)해 둔다.
 */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: PageResult<T>["error"] }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) return { data: all, error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_ROWS) return { data: all, error: null };
  }
}
