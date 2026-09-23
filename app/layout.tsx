import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";

const plexKr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-kr",
});

export const metadata: Metadata = {
  title: "강사잇다",
  description: "강사와 기관을 연결하는 구인구직 플랫폼",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3d2a6b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plexKr.variable} antialiased`}>
      <body className="bg-bg font-sans text-ink">
        {/* 강사 화면은 390px 기준. 넓은 화면에서는 가운데로 모아 휴대폰처럼 보이게 한다. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-b border-line bg-bg/90 px-4 backdrop-blur">
            <span className="text-[17px] font-bold tracking-tight text-brand">강사잇다</span>
          </header>

          {/* 아래 여백 = 하단 탭 높이(4rem) + 탭 윗선(1px) + 위쪽과 같은 여백(1.25rem).
              이보다 작으면 맨 아래 내용이 하단 탭에 가려진다. */}
          <main className="flex-1 px-4 pt-5 pb-[calc(4rem+1px+1.25rem+env(safe-area-inset-bottom))]">
            {children}
          </main>

          <BottomNav />
        </div>
      </body>
    </html>
  );
}
