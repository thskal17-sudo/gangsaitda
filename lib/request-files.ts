/*
 * 강의계획서 파일 규칙 (운영자가 추천 강사마다 올린다). 화면과 서버가 함께 쓴다.
 * 저장소에는 한글 이름을 쓸 수 없어 '의뢰번호/추천번호/시각.확장자' 로 두고, 원래 이름은 표에 따로 적는다.
 */

export const REQUEST_FILE_EXTENSIONS = ["pdf", "ppt", "pptx", "hwp", "hwpx", "doc", "docx", "jpg", "jpeg", "png"] as const;
export const REQUEST_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** 파일 고르기 창에 보일 종류 */
export const REQUEST_FILE_ACCEPT = REQUEST_FILE_EXTENSIONS.map((e) => `.${e}`).join(",");

export function requestFileExtension(fileName: string): (typeof REQUEST_FILE_EXTENSIONS)[number] | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (REQUEST_FILE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as (typeof REQUEST_FILE_EXTENSIONS)[number]) : null;
}

/** 이 추천 강사의 강의계획서가 놓일 폴더 (끝에 / 포함) */
export function planFolder(requestId: string, matchId: string): string {
  return `${requestId}/${matchId}/`;
}
