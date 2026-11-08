import { getAdminStatus } from "@/lib/admin";
import { CHULGANG_JS } from "@/lib/chulgang/assets";

/**
 * 출강잇다 동작 코드(JS). 정식 오픈 전(특허 출원 전)이라 관리자에게만 내려준다. 다른 사람에게는 없는 주소(404).
 * 공개 폴더(public/)에 두면 주소만 알면 누구나 내려받을 수 있어서 이렇게 한다.
 */
export async function GET() {
  if ((await getAdminStatus()) !== "admin") return new Response("Not Found", { status: 404 });
  return new Response(CHULGANG_JS, {
    headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "private, no-store" },
  });
}
