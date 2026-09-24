/** 로그인한 회원. 필요한 정보가 생기면 여기에 더한다. */
export type Member = {
  id: string;
};

/**
 * 지금 화면을 보는 사람이 회원인지 확인한다. 회원이 아니면 null.
 * 회원가입·로그인(Supabase)을 붙이기 전까지는 항상 '비회원'이다.
 */
export async function getCurrentMember(): Promise<Member | null> {
  return null;
}
