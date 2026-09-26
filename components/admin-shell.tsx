import Link from "next/link";
import NotFoundCard from "@/components/not-found-card";

/** 관리자 메뉴. 아직 만들지 않은 메뉴는 '준비 중'으로 보여주고 누를 수 없다. */
const MENU = [
  { key: "jobs", label: "공고 관리", href: "/admin" },
  { key: "new", label: "공고 등록", href: "/admin/jobs/new" },
  { key: "upload", label: "엑셀로 올리기", href: null },
  { key: "requests", label: "강사섭외 의뢰", href: "/admin/requests" },
  { key: "members", label: "회원", href: null },
] as const;

export type AdminMenuKey = (typeof MENU)[number]["key"];

/**
 * 관리자 화면의 틀. PC 는 왼쪽 메뉴 + 오른쪽 내용, 휴대폰은 위쪽 가로 메뉴(옆으로 밀어서 보기) + 아래 내용.
 */
export default function AdminShell({ active, children }: { active: AdminMenuKey; children: React.ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-8">
      <nav aria-label="관리자 메뉴" className="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:mb-0 md:overflow-visible md:px-0">
        <p className="mb-3 hidden text-[13px] font-semibold text-muted md:block">관리자</p>
        <ul className="flex gap-2 md:flex-col md:gap-1">
          {MENU.map((item) => {
            const isActive = item.key === active;
            const base =
              "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-control px-4 text-[15px] font-semibold md:h-11 md:w-full";
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`${base} ${isActive ? "bg-ink text-white" : "bg-white text-ink hover:bg-line md:bg-transparent"}`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={`${base} cursor-not-allowed bg-white text-muted md:bg-transparent`} aria-disabled="true">
                    {item.label}
                    <span className="rounded-badge bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">준비 중</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** 관리자가 아닌 회원이 관리자 화면 주소로 들어왔을 때 */
export function NotAdminCard() {
  return (
    <NotFoundCard
      title="관리자만 볼 수 있어요"
      description="이 화면은 강사잇다 운영자 전용입니다."
      primary={{ href: "/", label: "홈으로" }}
    />
  );
}
