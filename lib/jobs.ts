import { addDays } from "@/lib/date";

/** 공고 요약. 목록과 상세 화면 윗부분에 쓰고, 누구나 볼 수 있다. */
export type Job = {
  id: string;
  title: string;
  organization: string;
  region: string;
  /** 마감일 (한국 날짜). 예: "2026-09-25" */
  deadline: string;
};

/**
 * 공고 상세. 회원에게만 보여준다. 비어 있는 항목은 화면에 나오지 않는다.
 * 강사료·일정처럼 공고마다 형식이 다른 항목은 운영자가 글로 자유롭게 적는다.
 */
export type JobDetail = Job & {
  /** 강사료. 예: "시간당 40,000원" */
  pay: string;
  /** 수업 일정. 예: "매주 화·목 14:00~15:30 (10주)" */
  schedule: string;
  /** 수업 대상. 예: "초등 3~4학년 약 20명" */
  target?: string;
  /** 모집 인원 */
  headcount?: number;
  /** 상세 내용. 줄바꿈은 그대로 보여준다. */
  description: string;
  /** 지원 자격. 한 줄에 하나씩 적으면 목록으로 보여준다. */
  qualifications?: string;
  /** 제출 서류. 예: "이력서, 자격증 사본" */
  documents?: string;
  /** 지원 방법 — 셋 중 하나 이상 */
  applyUrl?: string;
  applyEmail?: string;
  applyPhone?: string;
};

type SampleJob = Omit<JobDetail, "deadline"> & { daysLeft: number };

/**
 * 화면 확인용 샘플 공고.
 * 마감일을 '오늘로부터 며칠 뒤'로 적어두어, 언제 열어봐도 마감임박·여유 공고가 섞여 보인다.
 * 일부러 마감 순서와 다르게 적어서 정렬이 제대로 되는지도 확인한다.
 * 연락처·주소는 모두 가짜다 (example.com, 0000 번호).
 */
const SAMPLE_JOBS: SampleJob[] = [
  {
    id: "sample-3",
    daysLeft: 9,
    organization: "다온테크 인재개발팀",
    title: "신입사원 대상 비즈니스 매너·커뮤니케이션 교육 강사 모집 (2회차)",
    region: "서울 강남구",
    pay: "회당 500,000원 (4시간)",
    schedule: "2회 (평일 중 협의, 회당 4시간)",
    target: "입사 1년 차 이내 신입사원 약 30명",
    headcount: 1,
    description:
      "신입사원을 대상으로 비즈니스 매너와 보고·소통 방법을 다루는 사내 교육입니다.\n교육 자료는 강사님이 준비하시며, 사전 협의를 거쳐 내용을 맞춥니다.",
    qualifications: "기업 교육 경력 3년 이상\n커뮤니케이션 관련 자격증 보유자 우대",
    documents: "강사 소개서, 강의 이력",
    applyUrl: "https://example.com/daon-apply",
  },
  {
    id: "sample-1",
    daysLeft: 0,
    organization: "새솔초등학교",
    title: "방과후 코딩(스크래치) 강사 모집",
    region: "서울 마포구",
    pay: "시간당 40,000원",
    schedule: "매주 화·목 14:00~15:30 (10주)",
    target: "초등 3~4학년 약 20명",
    headcount: 1,
    description:
      "스크래치로 간단한 게임과 애니메이션을 만들며 코딩의 기초를 익히는 수업입니다.\n교재와 노트북은 학교에서 준비합니다.",
    qualifications: "코딩 교육 경력 1년 이상\n초등학생 대상 수업 경험이 있으면 우대",
    documents: "이력서, 자격증 사본",
    applyEmail: "saesol-afterschool@example.com",
  },
  {
    id: "sample-5",
    daysLeft: 21,
    organization: "누리문화센터",
    title: "주말 캘리그라피 정규반 강사",
    region: "부산 해운대구",
    pay: "시간당 35,000원",
    schedule: "매주 토요일 14:00~16:00 (3개월)",
    target: "성인 12명",
    description: "붓펜과 붓으로 한글 캘리그라피의 기초부터 작품 완성까지 함께하는 정규반입니다.",
    qualifications: "캘리그라피 강의 경력 2년 이상",
    documents: "이력서, 작품 포트폴리오",
    applyEmail: "nuri-culture@example.com",
    applyPhone: "051-0000-0000",
  },
  {
    id: "sample-2",
    daysLeft: 2,
    organization: "한빛평생학습관",
    title: "어르신 스마트폰 활용 교실 강사",
    region: "경기 성남시",
    pay: "회당 80,000원 (2시간)",
    schedule: "매주 수요일 10:00~12:00 (8주)",
    target: "60세 이상 어르신 15명",
    headcount: 1,
    description:
      "카카오톡, 사진 정리, 키오스크 사용처럼 생활에 필요한 스마트폰 기능을 차근차근 알려드리는 수업입니다.",
    qualifications: "디지털 교육 또는 어르신 대상 강의 경험",
    documents: "이력서, 강의계획서",
    applyEmail: "hanbit-learning@example.com",
    applyPhone: "031-0000-0000",
  },
  {
    id: "sample-4",
    daysLeft: 14,
    organization: "푸른숲도서관",
    title: "어린이 그림책 읽기 특강 강사",
    region: "인천 연수구",
    pay: "회당 150,000원",
    schedule: "토요일 10:30~12:00 (1회 특강)",
    target: "5~7세 어린이와 보호자 20가족",
    headcount: 1,
    description:
      "그림책을 함께 읽고 이야기를 나누는 토요 특강입니다.\n책 읽기 뒤에 하는 만들기 활동 재료는 도서관에서 준비합니다.",
    qualifications: "독서지도 또는 유아 교육 경험",
    applyEmail: "pureunsup-library@example.com",
  },
  {
    // 마감이 지난 공고. 목록에는 안 나오고, 주소로 직접 들어왔을 때의 '마감' 화면 확인용.
    id: "sample-6",
    daysLeft: -3,
    organization: "햇살중학교",
    title: "진로 체험 특강(메이커 교육) 강사",
    region: "대전 서구",
    pay: "회당 120,000원",
    schedule: "1회 (2교시 연속)",
    target: "중학교 1학년 4개 반",
    headcount: 2,
    description: "3D 펜과 간단한 공작 도구로 진로 체험을 하는 메이커 특강입니다.",
    applyEmail: "haetsal-ms@example.com",
  },
];

/* today 는 샘플의 마감일을 계산하는 데만 쓴다. Supabase 를 붙이면 필요 없어진다. */

function withDeadline({ daysLeft, ...job }: SampleJob, today: string): JobDetail {
  return { ...job, deadline: addDays(today, daysLeft) };
}

function toSummary({ id, title, organization, region, deadline }: JobDetail): Job {
  return { id, title, organization, region, deadline };
}

/**
 * 지원할 수 있는 공고 목록 — 마감이 지나지 않은 것만, 마감 가까운 순.
 * 지금은 샘플을 돌려준다. Supabase 를 붙이면 이 함수 안쪽만 DB 조회로 바꾸면 된다.
 */
export async function getOpenJobs(today: string): Promise<Job[]> {
  return SAMPLE_JOBS.map((sample) => toSummary(withDeadline(sample, today)))
    .filter((job) => job.deadline >= today)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

/** 공고 요약 하나. 마감이 지난 공고도 돌려준다 (주소로 직접 들어온 경우). 없으면 null. */
export async function getJob(id: string, today: string): Promise<Job | null> {
  const sample = SAMPLE_JOBS.find((job) => job.id === id);
  return sample ? toSummary(withDeadline(sample, today)) : null;
}

/**
 * 공고 상세 하나. **회원에게만** 불러야 한다.
 * Supabase 를 붙일 때는 상세 내용을 따로 두고 회원만 읽을 수 있게 막아서,
 * 이 함수를 거치지 않고는 비회원이 상세 내용을 가져갈 수 없게 한다.
 */
export async function getJobDetail(id: string, today: string): Promise<JobDetail | null> {
  const sample = SAMPLE_JOBS.find((job) => job.id === id);
  return sample ? withDeadline(sample, today) : null;
}
