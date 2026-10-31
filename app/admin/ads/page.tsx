import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminAdForm from "@/components/admin-ad-form";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { formatKoreanDate, todayInSeoul } from "@/lib/date";
import { adImageUrl, getHomeAds, type HomeAd } from "@/lib/home-ads";

export const metadata: Metadata = { title: "광고 관리", robots: { index: false, follow: false } };

/**
 * 관리자 · 광고 관리. 홈 화면 '강사 경력에 더하는 교육과정' 카드 3개를 코드 수정 없이 넣고 바꾼다.
 * 과정 이름이 비어 있는 칸은 홈에서 '교육 광고 모집합니다' 자리로 보인다.
 */
export default async function AdminAdsPage() {
  await connection();
  if (!(await checkAdmin("/admin/ads"))) return <NotAdminCard />;

  const today = todayInSeoul();
  const ads = await getHomeAds();

  return (
    <AdminShell active="ads">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">광고 관리</h1>
      <p className="mt-1 text-sm text-muted">
        홈 화면 &lsquo;강사 경력에 더하는 교육과정&rsquo; 카드 3개예요. 저장하면{" "}
        <Link href="/" className="font-semibold text-brand hover:underline">
          홈 화면
        </Link>
        에 바로 보여요.
      </p>

      {ads ? (
        <div className="mt-5 flex flex-col gap-4">
          {ads.map((ad) => (
            <section key={ad.slot} className="rounded-card bg-white p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-[18px] font-bold tracking-tight">{ad.slot}번 칸</h2>
                <SlotState ad={ad} today={today} />
              </div>
              <AdminAdForm ad={ad} imageUrl={adImageUrl(ad.image)} />
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-card bg-white p-5 md:p-6">
          <h2 className="text-[18px] font-bold tracking-tight">광고 칸을 아직 고칠 수 없어요</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Supabase 관리 화면 → SQL Editor 에 <code className="rounded bg-bg px-1.5 py-0.5 text-ink">supabase/home-ads.sql</code> 내용을
            붙여넣고 Run 을 한 번 눌러 주세요. 그전까지 홈 화면에는 예전 카드가 그대로 보여요.
          </p>
        </div>
      )}
    </AdminShell>
  );
}

/** 칸 상태 배지: 광고 모집 자리 · 신청 중(마감일) · 지난 교육 */
function SlotState({ ad, today }: { ad: HomeAd; today: string }) {
  const [label, className] = !ad.name
    ? ["광고 모집 자리", "bg-bg text-muted"]
    : ad.until && ad.until < today
      ? ["지난 교육", "bg-ink/8 text-ink"]
      : ad.until
        ? [`${formatKoreanDate(ad.until)}까지 신청`, "bg-ok/10 text-ok"]
        : ["신청 중", "bg-ok/10 text-ok"];
  return <span className={`nums shrink-0 rounded-badge px-2.5 py-1 text-[12px] font-semibold ${className}`}>{label}</span>;
}
