/**
 * 공고 검색 (공고 화면의 검색칸). 주소에 ?q=검색어 가 붙는다.
 *
 * 받아 둔 목록 안에서 찾는다 (데이터베이스를 다시 부르지 않는다).
 * - 비회원: 제목에서만 찾는다 (비회원은 제목만 받으므로).
 * - 회원: 제목 + 기관 + 지역에서 찾는다.
 * 띄어쓰기와 대소문자는 무시한다: "시간 강사" 로 찾아도 "시간강사" 가 나온다.
 * 단어를 여러 개 적으면 모두 들어 있는 공고만 나온다: "초등 영어" → 초등도 영어도 있는 공고.
 */

/** 검색어 최대 길이 (주소에 붙는 값이라 너무 길면 자른다) */
const MAX_QUERY = 50;

/** 주소의 ?q= 값을 검색어로. 없거나 비어 있으면 "". */
export function parseQueryParam(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] : value;
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

/** 비교용 글자: 소문자로, 띄어쓰기 없이 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** 검색어를 단어로 나눈다 (비교용 글자로). 빈 검색어면 []. */
export function queryWords(query: string): string[] {
  return query.split(" ").map(normalize).filter(Boolean);
}

/** 이 공고가 검색어에 맞는가. 단어가 모두 제목·기관·지역 어딘가에 들어 있으면 맞는다. */
export function matchesQuery(job: { title: string; organization?: string; region?: string }, words: string[]): boolean {
  if (words.length === 0) return true;
  // 칸 사이에 '|' 를 넣어, 제목 끝과 기관 앞이 붙어서 엉뚱하게 맞는 일을 막는다
  const haystack = normalize([job.title, job.organization ?? "", job.region ?? ""].join("|"));
  return words.every((word) => haystack.includes(word));
}
