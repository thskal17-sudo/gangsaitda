import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/admin";
import { getProfileFileUrl } from "@/lib/admin-profiles";

/**
 * 관리자 · 강사 프로필 파일 내려받기. 누를 때마다 1분짜리 주소를 새로 만들어 그리로 보낸다.
 * 주소가 밖으로 새도 1분 뒤에는 열리지 않는다.
 */
export async function GET(_request: Request, ctx: RouteContext<"/admin/profiles/[id]/file">) {
  if ((await getAdminStatus()) !== "admin") {
    return new NextResponse("관리자만 내려받을 수 있습니다.", { status: 403 });
  }
  const { id } = await ctx.params;
  const url = await getProfileFileUrl(id);
  if (!url) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  return NextResponse.redirect(url);
}
