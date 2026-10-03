import { z } from "zod";

/*
 * 강사 프로필 입력 규칙. 화면(바로 안내)과 서버(최종 확인)가 같은 규칙을 쓴다.
 * 데이터베이스 규칙(supabase/instructor-profiles.sql)과 길이·지역이 같다.
 */

/**
 * 활동 가능 지역 (권역). 여러 개 고를 수 있다. 데이터베이스 규칙(supabase/instructor-profiles.sql)과 같아야 한다.
 * 경기권 = 서울·경기·인천, 경상권 = 부산·울산·경남·대구·경북, 전라권 = 광주·전북·전남, 충청권 = 대전·세종·충북·충남
 */
export const PROFILE_REGIONS = ["전국구", "경기권", "강원권", "충청권", "전라권", "경상권", "제주권"] as const;

/** 올릴 수 있는 파일: PDF, 파워포인트, 한글, 워드. 10MB 까지 */
export const PROFILE_FILE_EXTENSIONS = ["pdf", "ppt", "pptx", "hwp", "hwpx", "doc", "docx"] as const;
export const PROFILE_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** 파일 이름에서 확장자(소문자). 올릴 수 없는 종류면 null */
export function profileFileExtension(fileName: string): (typeof PROFILE_FILE_EXTENSIONS)[number] | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (PROFILE_FILE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as (typeof PROFILE_FILE_EXTENSIONS)[number]) : null;
}

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}은(는) ${max}자까지 입력할 수 있습니다.`);

export const profileSchema = z
  .object({
    fields: z.string().trim().min(1, "강의 분야를 입력해 주세요.").max(100, "강의 분야는 100자까지 입력할 수 있습니다."),
    regions: z.array(z.enum(PROFILE_REGIONS)).min(1, "활동 가능 지역을 하나 이상 골라 주세요."),
    method: z.enum(["form", "file"]),
    career: optionalText(2000, "강의 경력"),
    certificates: optionalText(1000, "자격·학력"),
    intro: optionalText(500, "자기소개"),
    collectAgreed: z.literal(true, "프로필 수집·이용에 동의해야 낼 수 있습니다."),
    shareAgreed: z.literal(true, "의뢰 기관 전달에 동의해야 낼 수 있습니다."),
  })
  .superRefine((v, ctx) => {
    if (v.method === "form" && v.career === "") {
      ctx.addIssue({ code: "custom", path: ["career"], message: "강의 경력을 입력해 주세요." });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
