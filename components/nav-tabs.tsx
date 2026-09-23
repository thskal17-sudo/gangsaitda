/**
 * 메뉴 목록. 휴대폰의 하단 탭과 PC의 위쪽 메뉴가 함께 쓴다.
 * 메뉴를 늘리거나 이름을 바꿀 때는 이 배열만 고치면 된다.
 */
export const TABS = [
  {
    href: "/",
    label: "홈",
    icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    href: "/jobs",
    label: "공고",
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
        <path d="M3 12h18" />
      </>
    ),
  },
];

/** 지금 주소(pathname)가 이 메뉴에 속하는지. 예: /jobs/123 은 '공고'에 속한다. */
export function isTabActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
