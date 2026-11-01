import { normalizeDate } from "@/lib/job-excel";

/*
 * 수집 공고의 마감일이 믿을 만한지 본다 (lib/job-import.ts 가 부른다).
 *
 * 수시 접수 공고("채용될 때까지 수시로 접수")는 정해진 마감일이 없어서, 수집 프로그램이 공고 안의 다른 날짜
 * (보통 수업이 끝나는 날)를 마감일로 가져온다. 그러면 이미 사람을 뽑은 공고가 'D-119'처럼 넉넉히 남은 것으로 보인다.
 * 아래에 걸리면 '숨김'으로 넣고 운영자 카톡으로 알린다. 운영자가 원문을 보고 마감일을 고친 뒤 '다시 올리기'로 공개한다.
 */

/** 수시·상시 접수를 뜻하는 말. "적격자 채용 시 조기 마감"처럼 마감일이 따로 있는 말은 걸리지 않는다. */
const ROLLING = /수시\s*(로\s*)?(접수|모집|채용)|상시\s*(로\s*)?(접수|모집|채용)|(채용|충원|선발)\s*(완료\s*)?(시|될\s*때)\s*까지/;

/** 글 안의 날짜들. "2027.02.28", "2027-2-28", "2027. 2. 28", "2027년 2월 28일" */
const DATES = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;

type Fields = { title: string; deadline: string; schedule: string; description: string; qualifications?: string; documents?: string };

/** 마감일을 확인해야 하는 이유들. 없으면 빈 목록 (그대로 공개해도 됨) */
export function deadlineReviewReasons(job: Fields): string[] {
  const reasons: string[] = [];

  const text = [job.title, job.description, job.schedule, job.qualifications ?? "", job.documents ?? ""].join("\n");
  if (ROLLING.test(text)) reasons.push("수시 접수");

  const dates = [...job.schedule.matchAll(DATES)].map((m) => normalizeDate(`${m[1]}-${m[2]}-${m[3]}`));
  if (dates.length > 0 && dates[dates.length - 1] === job.deadline) reasons.push("마감일이 수업 끝나는 날과 같음");

  return reasons;
}
