import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/admin";
import { filterMembers, getAllMembers, membersCsv, parseMemberFilter } from "@/lib/admin-members";
import { todayInSeoul } from "@/lib/date";

/**
 * 관리자 · 회원 목록 엑셀(CSV) 내려받기. 회원 화면에서 보던 조건(?q=검색어, ?sms=1 문자 수신 동의만) 그대로.
 * 개인정보라 관리자만, 저장해 두지 않게(no-store) 보낸다.
 */
export async function GET(request: Request) {
  if ((await getAdminStatus()) !== "admin") {
    return new NextResponse("관리자만 내려받을 수 있습니다.", { status: 403 });
  }
  const sp = new URL(request.url).searchParams;
  const filter = parseMemberFilter({ q: sp.get("q") ?? undefined, sms: sp.get("sms") ?? undefined });
  const members = filterMembers(await getAllMembers(), filter);

  const name = `강사잇다_회원${filter.smsOnly ? "_문자동의" : ""}_${todayInSeoul().replace(/-/g, "")}.csv`;
  return new NextResponse(membersCsv(members), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="members.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}
