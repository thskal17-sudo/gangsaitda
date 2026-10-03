/*
 * 비밀번호 재설정에 함께 쓰는 값 (서버 액션과 새 비밀번호 화면).
 */

/** 메일 속 링크가 여는 새 비밀번호 화면 */
export const NEW_PASSWORD_PATH = "/account/new-password";

/**
 * 메일 링크로 본인 확인을 마친 사람이라는 표시 (15분). 값은 그 회원의 번호.
 * 메일 링크는 한 번만 쓸 수 있어서, 확인은 됐는데 비밀번호 저장이 실패하면(예: 너무 쉬운 비밀번호)
 * 같은 링크로 다시 시도할 수 없다. 이 표시가 있으면 확인을 건너뛰고 다시 저장할 수 있게 한다.
 */
export const RECOVERY_COOKIE = "gs-recovery";

/** 메일 링크에 붙어 오는 값. 우리 메일 문구는 tokenHash, Supabase 기본 문구는 code 를 준다. */
export type RecoveryToken = { tokenHash?: string; code?: string };
