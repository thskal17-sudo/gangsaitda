import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";
import HeaderAuth from "@/components/header-auth";
import TopNav from "@/components/top-nav";
import { getCurrentMember } from "@/lib/member";

/*
 * 한글 글꼴은 글자 묶음별로 잘게 나뉜 파일 수백 개로 되어 있다.
 * 미리 받기(preload)를 켜두면 모든 화면이 처음 열릴 때 전부(약 2.4MB) 받으므로 끈다.
 * 끄면 브라우저가 화면에 실제로 나온 글자에 필요한 파일만 받는다.
 */
const plexKr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  preload: false,
  display: "swap",
  variable: "--font-plex-kr",
});

export const metadata: Metadata = {
  title: { default: "강사잇다", template: "%s | 강사잇다" },
  description: "강사와 기관을 연결하는 구인구직 플랫폼",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3d2a6b",
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
    <html lang="ko" className={`${plexKr.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col bg-bg font-sans text-ink">
        <header className="sticky top-0 z-10 mx-auto w-full max-w-[430px] shrink-0 border-b border-line bg-bg/90 backdrop-blur md:max-w-none">
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
