/**
 * Supabase 는 한 번에 1000줄까지만 돌려준다 (그 뒤는 말없이 잘림).
 * 표 전체가 필요한 곳(같은 공고 찾기 등)은 이 함수로 1000줄씩 나눠 끝까지 읽는다.
 *
 * page(from, to) 는 정렬이 정해진 쿼리에 .range(from, to) 를 붙여 돌려줘야 한다
 * (정렬이 없으면 쪽마다 순서가 달라 빠지거나 겹칠 수 있다).
 *
 * 2026-11-12: 공고가 1000건을 넘자 받는 문이 1000번째 뒤 공고를 '없는 공고'로 보고
 * 수집이 돌 때마다 같은 30건을 새로 넣어 Threads 에 같은 글이 하루 여러 번 올라갔다.
 */
export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

export async function readAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string; code?: string } }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const got = data ?? [];
    rows.push(...got);
    if (got.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
