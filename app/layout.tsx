import type { Metadata, Viewport } from "next";
import Link from "next/link";
// 글꼴: Pretendard (무료, 상업적 이용 가능). 화면에 나온 글자에 필요한 조각만 받는다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";
import HeaderAuth from "@/components/header-auth";
import TopNav from "@/components/top-nav";
import { getCurrentMember } from "@/lib/member";

export const metadata: Metadata = {
  title: { default: "강사잇다", template: "%s | 강사잇다" },
  description: "강사와 기관을 연결하는 구인구직 플랫폼",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

/*
 * 화면 폭에 따라 두 가지 모양을 쓴다.
 * - 휴대폰 (768px 미만): 390px 기준. 넓어도 가운데 430px 로 모으고, 메뉴는 하단 탭.
 * - PC·태블릿 (768px 이상): 본문 최대 1080px, 메뉴는 위쪽 띠 오른쪽.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 위쪽 띠에 로그인/로그아웃 중 무엇을 보여줄지 정한다.
  const member = await getCurrentMember();

  return (
    <html lang="ko" className="antialiased">
      <body className="flex min-h-dvh flex-col bg-bg font-sans text-ink">
        <header className="sticky top-0 z-10 mx-auto w-full max-w-[430px] shrink-0 bg-white/90 backdrop-blur md:max-w-none">
          <div className="mx-auto flex h-14 items-center justify-between px-4 md:h-16 md:max-w-[1080px] md:px-8">
            <Link href="/" className="text-[17px] font-bold tracking-tight text-brand md:text-[19px]">
              강사잇다
            </Link>
            <div className="flex items-center gap-2 md:gap-4">
              <TopNav />
              <HeaderAuth isMember={member !== null} />
            </div>
          </div>
        </header>

        {/* 휴대폰 아래 여백 = 하단 탭 높이(4rem) + 탭 윗선(1px) + 위쪽과 같은 여백(1.25rem).
            이보다 작으면 맨 아래 내용이 하단 탭에 가려진다. PC 에는 하단 탭이 없다. */}
        <main className="mx-auto w-full max-w-[430px] flex-1 px-4 pt-5 pb-[calc(4rem+1px+1.25rem+env(safe-area-inset-bottom))] md:max-w-[1080px] md:px-8 md:pt-10 md:pb-16">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
