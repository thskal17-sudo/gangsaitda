import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 기관 담당자 · 추천 강사의 파일 내려받기 (?kind=plan 강의계획서, ?kind=profile 강사 프로필 파일).
 * 1) 데이터베이스 함수(my_match_file)가 '내 의뢰이고 기관 확인됐는지'를 확인해 파일 자리를 알려 준다.
 * 2) 담당자는 저장소를 직접 읽을 수 없으므로, 사이트 서버 열쇠로 1분짜리 주소를 만들어 그리로 보낸다.
 */
export async function GET(request: Request, ctx: RouteContext<"/account/requests/[id]/file/[matchId]">) {
  const { id, matchId } = await ctx.params;
  if (!(await getCurrentMember())) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/account/requests/${id}`)}`, request.url));
  }
  const kind = new URL(request.url).searchParams.get("kind") === "plan" ? "plan" : "profile";
  if (!/^\d{1,15}$/.test(matchId)) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_match_file", { p_match_id: Number(matchId), p_kind: kind });
  const file = (data as { bucket: string; path: string; file_name: string | null; instructor_name: string }[] | null)?.[0];
  if (error || !file) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });

  const service = createServiceClient();
  if (!service) return new NextResponse("지금은 내려받을 수 없습니다. 잠시 뒤에 다시 시도해 주세요.", { status: 503 });
  const { data: signed, error: signError } = await service.storage.from(file.bucket).createSignedUrl(file.path, 60);
  if (signError || !signed) {
    console.error("[my-request] 파일 주소 만들기 실패", signError?.message);
    return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  }
  const downloadName = `${file.instructor_name}_${file.file_name ?? (kind === "plan" ? "강의계획서" : "프로필")}`;
  return NextResponse.redirect(`${signed.signedUrl}&download=${encodeURIComponent(downloadName)}`);
}
