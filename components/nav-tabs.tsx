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
  {
    href: "/certificates",
    label: "자격증",
    icon: (
      <>
        <circle cx="12" cy="9" r="5.5" />
        <path d="m8.5 13.3-1.5 7.7 5-2.5 5 2.5-1.5-7.7" />
      </>
    ),
  },
  {
    href: "/request",
    label: "강사섭외",
    icon: (
      <>
        <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
        <path d="M15 9h3a2 2 0 0 1 2 2v10" />
        <path d="M2.5 21h19M8 7h3M8 11h3M8 15h3" />
      </>
    ),
  },
];

/**
 * 마지막 칸은 로그인 상태에 따라 바뀐다.
 * 비회원: '회원가입' (가입 화면으로), 회원: '로그아웃' (누르면 보던 화면에 그대로 머문다)
 */
export const SIGNUP_TAB = {
  href: "/signup",
  label: "회원가입",
  icon: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2.5 20.5a7.5 7.5 0 0 1 15 0M19 8v6M16 11h6" />
    </>
  ),
};

export const LOGOUT_TAB = {
  label: "로그아웃",
  icon: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
};

/** 지금 주소(pathname)가 이 메뉴에 속하는지. 예: /jobs/123 은 '공고'에 속한다. */
export function isTabActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
