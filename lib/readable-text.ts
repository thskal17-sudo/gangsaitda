/*
 * 공고 상세 내용을 읽기 좋게 보여 주기 (화면에서만, 저장된 글은 그대로).
 *
 * 수집 프로그램이 첨부 공고문(한글·PDF)에서 글자만 뽑아 오면 줄바꿈이 모두 사라지고 띄어쓰기도 깨진다.
 * 예) "… 공모 안내 Ⅰ 강좌 공모 가 . 공모개요 ○ 공모 학기 : 2026 학년도 겨울계절학기 ○ 공모 기간 : 2026. 11. 2.( 월 ) …"
 * (2026-11-04 부산대학교 미래시민교육원 강좌 공모, 1500자 한 줄)
 *
 * 줄바꿈이 거의 없는 긴 글만 고친다. 운영자가 직접 쓴 글(줄바꿈이 있는 글)은 손대지 않는다.
 *  - 공고문에서 흔한 머리표(○ ※ ▷ ■ □ Ⅰ …), '가.' '1.' 같은 항목 번호, '<공모방법>' 같은 소제목 앞에서 줄을 바꾼다
 *  - 글자를 뽑으며 생긴 띄어쓰기를 붙인다 ('( 월 )' → '(월)', '1 인당' → '1인당', '강좌 ,' → '강좌,')
 */

/** 줄바꿈 없이 이만큼 넘는 글만 고친다 */
const MIN_LENGTH = 200;

/** 줄 앞에 오는 머리표 */
const BULLETS = "○●◎■□▷▶►※◆◇★☞❍◦";
/** 큰 번호 (Ⅰ Ⅱ …) */
const ROMAN = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ";

/** 이미 줄이 나뉜 글인가 (평균 한 줄이 300자 안쪽이면 그렇다고 본다) */
function alreadyFormatted(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim()).length;
  return text.length / Math.max(lines, 1) < 300;
}

/** 글자를 뽑으며 생긴 띄어쓰기를 붙인다 */
function fixSpacing(text: string): string {
  return (
    text
      // 괄호 안쪽 빈칸: "( 월 )" → "(월)", "[ 로그인 화면 ]" → "[로그인 화면]"
      .replace(/([(\[])\s+/g, "$1")
      .replace(/\s+([)\]])/g, "$1")
      // 쉼표·마침표·쌍점 앞 빈칸: "강좌 ," → "강좌,", "학기 :" → "학기:"
      .replace(/\s+([,.:;])/g, "$1")
      // 숫자와 단위: "2026 학년도" → "2026학년도", "1 인당" → "1인당", "3 년이내" → "3년이내", "7 층 704 호" → "7층 704호"
      .replace(/(\d)\s+(학년도|년도|년|개월|인|개|회|층|호|명|차|시간|학기)/g, "$1$2")
      // '월·일·주' 는 뒤에 글자가 이어지면 다른 낱말일 수 있어 ("5 일반과정") 홀로 있을 때만
      .replace(/(\d)\s+(월|일|주)(?![가-힣])/g, "$1$2")
      // 글자가 깨진 가운뎃점: "강의 ? 근무" → "강의 · 근무"
      .replace(/([가-힣)])\s\?\s(?=[가-힣(])/g, "$1 · ")
  );
}

/** 공고문의 구조(머리표·항목 번호·소제목) 앞에서 줄을 바꾼다 */
function breakLines(text: string): string {
  const bullet = new RegExp(`\\s*([${BULLETS}])\\s*`, "g");
  const roman = new RegExp(`\\s*([${ROMAN}])\\s+`, "g");
  return (
    text
      // 소제목 "< 공모방법 >" → 빈 줄 + "<공모방법>"
      .replace(/\s*<\s*([^<>\n]{1,24}?)\s*>\s*/g, "\n\n<$1>\n")
      // 큰 번호 "Ⅰ 강좌 공모" → 빈 줄 + "Ⅰ 강좌 공모"
      .replace(roman, "\n\n$1 ")
      // 머리표 "○ 공모 학기" → 줄 바꿈 + "○ 공모 학기"
      .replace(bullet, "\n$1 ")
      // 한글 항목 번호 "가 . 공모개요" / "가. 공모개요" (앞이 빈칸일 때만)
      .replace(/\s([가나다라마바사아자차카타파하])\s?\.\s+(?=[가-힣A-Za-z(])/g, "\n$1. ")
      // 숫자 항목 번호 "1. 강좌 개요" (날짜 "11. 2." 는 뒤가 숫자라 걸리지 않는다)
      .replace(/\s(\d{1,2})\.\s+(?=[가-힣A-Za-z(])/g, "\n$1. ")
      // 줄표 목록 " - (자격)" " - 1차 내부" (전화번호 '510-8370' 처럼 붙은 줄표는 그대로)
      .replace(/\s+-\s+(?=\S)/g, "\n- ")
  );
}

/** 화면에 보여 줄 상세 내용. 줄바꿈 없는 긴 글이면 줄을 나누고 띄어쓰기를 고친다.
 *  collected: 수집 프로그램이 가져온 공고면 '수집 공고 상세 내용 규칙'(tidyCollected)도 적용한다 (title 은 공고 제목). */
export function readableText(text: string, options: { collected?: boolean; title?: string } = {}): string {
  if (!text) return text;
  let out = text;
  if (out.length >= MIN_LENGTH && !alreadyFormatted(out)) {
    out = breakLines(fixSpacing(out))
      .split("\n")
      .map((line) => line.replace(/\s{2,}/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return options.collected ? tidyCollected(out, options.title) : out;
}

/*
 * 수집 공고 상세 내용 규칙 (2026-11-04)
 *
 * 수집 프로그램은 공고문 본문을 통째로 가져온다. 공고문 안의 표(강좌명·요일·시간·장소·인원)는 글자로 풀리면
 * 칸이 다 붙은 한 줄('노래교실월 10:00～12:0020취미교실1,21명…')과 칸마다 한 줄씩 쪼개진 조각('강 좌 명' / '노래교실' / …)이
 * 되어 읽을 수 없다 (김해시 칠산서부동 교양강좌 강사 공고).
 *  1) 표에서 풀린 글은 빼고, 그 자리에 '원문 공고에서 확인' 안내를 한 줄 넣는다
 *  2) 한글 문서 기호 글꼴의 머리표(화면에 '≣'처럼 보임)는 '-'로 바꾼다
 *  3) 800자까지만 둔다 (줄 단위로 자르고, 잘랐으면 '…')
 *  4) 모양 통일 (2026-11-05): 위 정보 칸과 겹치는 줄(예전 수집 프로그램이 본문 대신 쓰던 제목·분야·접수 마감·원문 주소)을 빼고,
 *     끝에 늘 같은 안내 한 줄(CLOSING)을 붙인다. 남은 본문이 없으면 NO_BODY 한 줄만 둔다.
 * 받는 문(lib/job-import.ts)이 저장하기 전에, 공고 화면이 이미 올라간 공고를 보여 줄 때 이 규칙을 쓴다.
 * 기관·운영자가 직접 쓴 공고에는 쓰지 않는다.
 */

/** 수집 공고 상세 내용 길이 한도 */
export const COLLECTED_MAX = 800;
export const TABLE_NOTICE = "(표로 된 내용은 원문 공고에서 확인해 주세요)";
/** 모든 수집 공고 상세 내용 끝에 붙는 안내 */
export const CLOSING = "자세한 내용과 지원 방법은 '원문 공고 보기'에서 확인해 주세요.";
/** 본문을 가져오지 못한 수집 공고의 상세 내용 */
export const NO_BODY = "공고 내용은 '원문 공고 보기'에서 확인해 주세요.";
/** 예전 규칙이 자른 글 끝에 붙이던 안내 (다시 정리할 때 뺀다) */
const OLD_MORE_NOTICE = "… 나머지 내용은 원문 공고에서 확인해 주세요.";

/** 예전 수집 프로그램이 본문 대신 쓰던 안내 글의 표시 줄. 이 줄이 있는 글에서만 아래 겹치는 줄을 뺀다. */
const STUB_MARK = /^(?:자세한 내용과 지원 방법은 원문 공고를 확인해 주세요\.|원문 공고:\s*https?:\/\/\S+)$/;
/** 위 정보 칸과 겹치는 줄 ('분야: 학교 시간강사', '접수 마감: 2026-11-04') */
const STUB_LINE = /^(?:분야|접수 마감):\s/;

function squash(s: string): string {
  return s.replace(/\s+/g, "");
}

/** 예전 안내 글(제목·분야·접수 마감·원문 주소)에서 위 정보 칸과 겹치는 줄을 뺀다. 다른 글은 그대로. */
function dropStub(lines: string[], title?: string): string[] {
  if (!lines.some((line) => STUB_MARK.test(line.trim()))) return lines;
  const key = title ? squash(title) : "";
  return lines.filter((line, i) => {
    const t = line.trim();
    if (STUB_MARK.test(t) || STUB_LINE.test(t)) return false;
    // 첫 줄의 원문 제목 ('2026학년도 한얼고등학교 …'은 사이트 제목 '한얼고등학교 …'을 품는다)
    return !(i === 0 && key.length >= 5 && squash(t).includes(key));
  });
}

/** 이만큼 짧은 줄이 이만큼 이어지면 표 칸이 쪼개진 것으로 본다 */
const FRAGMENT_LENGTH = 20;
const FRAGMENT_RUN = 6;
/** 머리표·항목 번호로 시작하는 줄 (짧아도 목록이라 표 조각으로 보지 않는다) */
const LIST_MARK = new RegExp(`^(?:[${BULLETS}${ROMAN}□\\-·•]|\\d{1,2}[.)]|[가-하][.)]|\\(\\d{1,2}\\)|<)`);
const TIME_RANGE = /\d{1,2}:\d{2}\s*[~～∼-]\s*\d{1,2}:\d{2}/g;

/** 칸이 다 붙은 표 줄인가: 빈칸이 매우 적은데 시간 범위가 여럿이거나, 길다 */
function isMashedTableLine(line: string): boolean {
  const spaces = (line.match(/\s/g) ?? []).length / Math.max(line.length, 1);
  const times = (line.match(TIME_RANGE) ?? []).length;
  return (times >= 3 && spaces < 0.12) || (line.length >= 100 && spaces < 0.08);
}

function isShort(line: string): boolean {
  const t = line.trim();
  return t !== "" && t.length <= FRAGMENT_LENGTH;
}

/** 머리표·번호가 없는 짧은 줄 (표 칸 조각일 수 있음) */
function isFragment(line: string): boolean {
  return isShort(line) && !LIST_MARK.test(line.trim());
}

/** 표에서 풀린 줄을 빼고 그 자리에 안내를 한 번 넣는다 */
function dropTables(text: string): string {
  const lines = text.split("\n");
  const drop = lines.map((line) => isMashedTableLine(line));
  // 짧은 줄이 이어진 덩어리. 머리표 없는 조각이 6줄 넘고 덩어리의 2/3 이상이면 표로 본다.
  // ('12. 31.'처럼 번호처럼 보이는 조각도 덩어리 안에 있으면 함께 빼고, 덩어리 앞뒤의 '□ 모집강좌' 같은 머리표 줄은 남긴다.)
  for (let i = 0; i < lines.length; ) {
    if (!isShort(lines[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < lines.length && isShort(lines[j])) j += 1;
    let start = i;
    let end = j;
    while (start < end && !isFragment(lines[start])) start += 1;
    while (end > start && !isFragment(lines[end - 1])) end -= 1;
    const fragments = lines.slice(start, end).filter(isFragment).length;
    if (fragments >= FRAGMENT_RUN && fragments * 3 >= (end - start) * 2) for (let k = start; k < end; k += 1) drop[k] = true;
    i = j;
  }
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!drop[i]) out.push(line);
    else if (out[out.length - 1] !== TABLE_NOTICE) out.push(TABLE_NOTICE);
  });
  return out.join("\n");
}

/** 안내 한 줄까지 800자 안쪽이 되게 (줄 단위로, 한 줄이 너무 길면 빈칸에서) 자르고 '…'를 붙인다 */
function capLength(text: string): string {
  const limit = COLLECTED_MAX - CLOSING.length - 3;
  if (text.length <= limit) return text;
  let cut = text.lastIndexOf("\n", limit);
  if (cut < limit / 2) cut = text.lastIndexOf(" ", limit);
  if (cut < limit / 2) cut = limit;
  return `${text.slice(0, cut).trimEnd()} …`;
}

/** 수집 공고 상세 내용 규칙을 적용한다 (위 설명 참고). 몇 번을 적용해도 결과가 같다. title: 공고 제목 */
export function tidyCollected(text: string, title?: string): string {
  if (!text) return NO_BODY;
  // 한글 문서의 기호 글꼴로 쓴 머리표(U+F06D 등 사용자 정의 영역 글자)는 화면에 '≣' 같은 이상한 모양으로 나온다 → '-'
  const plain = text.replace(/^[ \t]*[\uE000-\uF8FF]+[ \t]*/gm, "- ").replace(/[\uE000-\uF8FF]/g, "");
  // 이미 붙은 안내 줄은 빼고 다시 붙인다 (여러 번 적용해도 한 번만 붙게)
  const lines = plain.split("\n").filter((line) => ![CLOSING, NO_BODY, OLD_MORE_NOTICE].includes(line.trim()));
  const body = capLength(dropTables(dropStub(lines, title).join("\n")).replace(/\n{3,}/g, "\n\n").trim());
  return body ? `${body}\n\n${CLOSING}` : NO_BODY;
}
