import { z } from "zod";

/*
 * 공고 지원 입력 규칙 (강사 회원이 '강사잇다 모집' 공고에 지원할 때). 화면과 서버가 함께 쓴다.
 * 파일은 따로 올리고(lib/apply-actions.ts), 여기서는 한마디와 동의만 확인한다.
 */

export const applySchema = z.object({
  message: z.string().trim().max(500, "한마디는 500자까지 적을 수 있어요."),
  shareAgreed: z.literal(true, "기관에 지원 정보를 전달하는 데 동의해야 지원할 수 있어요."),
});

export type ApplyInput = z.infer<typeof applySchema>;

/** 지원할 때 올린 파일 (저장소 자리와 원래 이름) */
export type ApplyUpload = { path: string; fileName: string };
