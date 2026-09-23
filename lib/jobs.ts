import { addDays } from "@/lib/date";

export type Job = {
  id: string;
  title: string;
  organization: string;
  region: string;
  /** 마감일 (한국 날짜). 예: "2026-09-25" */
  deadline: string;
};

/**
 * 화면 확인용 샘플 공고.
 * 마감일을 '오늘로부터 며칠 뒤'로 적어두어, 언제 열어봐도 마감임박·여유 공고가 섞여 보인다.
 * 일부러 마감 순서와 다르게 적어서 정렬이 제대로 되는지도 확인한다.
 */
const SAMPLE_JOBS: (Omit<Job, "deadline"> & { daysLeft: number })[] = [
  {
    id: "sample-3",
    daysLeft: 9,
    organization: "다온테크 인재개발팀",
    title: "신입사원 대상 비즈니스 매너·커뮤니케이션 교육 강사 모집 (2회차)",
    region: "서울 강남구",
  },
  {
    id: "sample-1",
    daysLeft: 0,
    organization: "새솔초등학교",
    title: "방과후 코딩(스크래치) 강사 모집",
    region: "서울 마포구",
  },
  {
    id: "sample-5",
    daysLeft: 21,
    organization: "누리문화센터",
    title: "주말 캘리그라피 정규반 강사",
    region: "부산 해운대구",
  },
  {
    id: "sample-2",
    daysLeft: 2,
    organization: "한빛평생학습관",
    title: "어르신 스마트폰 활용 교실 강사",
    region: "경기 성남시",
  },
  {
    id: "sample-4",
    daysLeft: 14,
    organization: "푸른숲도서관",
    title: "어린이 그림책 읽기 특강 강사",
    region: "인천 연수구",
  },
];

/**
 * 지원할 수 있는 공고 목록 — 마감이 지나지 않은 것만, 마감 가까운 순.
 * 지금은 샘플을 돌려준다. Supabase 를 붙이면 이 함수 안쪽만 DB 조회로 바꾸면 된다.
 */
export async function getOpenJobs(today: string): Promise<Job[]> {
  return SAMPLE_JOBS.map(({ daysLeft, ...job }) => ({
    ...job,
    deadline: addDays(today, daysLeft),
  }))
    .filter((job) => job.deadline >= today)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}
