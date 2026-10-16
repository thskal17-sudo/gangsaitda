import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/admin";
import { getPlanFileUrl } from "@/lib/admin-requests";

/** 관리자 · 강의계획서 내려받기. 누를 때마다 1분짜리 주소를 새로 만들어 그리로 보낸다. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/requests/[id]/plan/[matchId]">) {
  if ((await getAdminStatus()) !== "admin") {
    return new NextResponse("관리자만 내려받을 수 있습니다.", { status: 403 });
  }
  const { id, matchId } = await ctx.params;
  const url = await getPlanFileUrl(id, matchId);
  if (!url) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  return NextResponse.redirect(url);
}
