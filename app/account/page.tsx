import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import LogoutRow from "@/components/mypage-logout";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { getMyMatches, isFinished } from "@/lib/my-matches";
import { getMyRequests } from "@/lib/my-requests";
import { getMyProfile } from "@/lib/profile";
import { getMySavedCount } from "@/lib/saved-jobs";
import { getMySmsConsent } from "@/lib/sms-consent";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false, follow: false } };

/**
 * 마이페이지 (회원만). 위쪽 띠의 [마이페이지] 버튼으로 들어온다. 회원 종류에 따라 메뉴가 다르다.
 * - 강사 회원: 관심 공고(담은 수) · 지원·추천 현황(진행 중 수) · 내 프로필(등록 여부) · 출강잇다 · 문자 수신 설정 · 로그아웃
 * - 기관 회원: 내 의뢰(보낸 수) · 활용설명서 · 문자 수신 설정 · 로그아웃
 * 회원 종류를 아직 모르면(SQL 실행 전) 강사 메뉴를 보여 준다 (가입할 때 기본 종류가 강사).
 * 회원 탈퇴는 지금처럼 사이트 맨 아래 링크에 둔다.
 */
export default async function MyPage() {
  await connection();
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/account");
  const memberType = await getMemberType();
  const isOrg = memberType === "기관";

  const supabase = await createClient();
  const { data } = await supabase.from("members").select("name").eq("id", member.id).maybeSingle();
  const name = (data as { name: string } | null)?.name;
  const sms = await getMySmsConsent(member.id);
  const smsText = sms ? (sms.agreed ? "받음" : "받지 않음") : undefined;

  let items: MenuItem[];
  if (isOrg) {
    const requests = await getMyRequests().catch(() => null);
    items = [
      { href: "/account/requests", label: "내 의뢰", info: requests ? `${requests.length}건` : undefined, description: "보낸 강사섭외 의뢰와 추천 강사 보기" },
      { href: "/guide", label: "활용설명서", description: "의뢰부터 강사 확정까지 이용 방법" },
      { href: "/account/sms", label: "문자 수신 설정", info: smsText },
    ];
  } else {
    const [savedCount, matches, profile] = await Promise.all([getMySavedCount(), getMyMatches(), getMyProfile(member.id)]);
    const ongoing = matches?.filter((m) => !isFinished(m)).length;
    items = [
      { href: "/account/applications", label: "관심 공고", info: savedCount === null ? undefined : `${savedCount}건`, description: "☆로 담아 둔 공고와 지원했어요 기록" },
      {
        href: "/account/applications?tab=progress",
        label: "지원·추천 현황",
        info: ongoing === undefined ? undefined : `진행 중 ${ongoing}건`,
        description: "강사잇다 모집 공고 지원과 운영자 추천 진행",
      },
      {
        href: "/account/profile",
        label: "내 프로필",
        info: profile ? "등록함" : "등록 전",
        infoTone: profile ? undefined : "text-accent",
        description: "기관 의뢰가 오면 운영자가 골라 전달하는 프로필",
      },
      { href: "/chulgang", label: "출강잇다", description: "내 구글 캘린더로 강의 일정·강의료·입금 관리" },
      { href: "/account/sms", label: "문자 수신 설정", info: smsText },
    ];
  }

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">마이페이지</h1>
      <p className="mt-1.5 text-[15px] text-muted">
        {name ? (
          <>
            <b className="text-ink">{name}</b> {isOrg ? "담당자님" : "강사님"}, 안녕하세요.
          </>
        ) : (
          "안녕하세요."
        )}
      </p>

      <ul className="mt-5 overflow-hidden rounded-card bg-white">
        {items.map((item) => (
          <li key={item.href} className="border-b border-line last:border-b-0">
            <MenuLink item={item} />
          </li>
        ))}
      </ul>

      <div className="mt-3 overflow-hidden rounded-card bg-white">
        <LogoutRow />
      </div>
    </section>
  );
}

type MenuItem = { href: string; label: string; info?: string; infoTone?: string; description?: string };

function MenuLink({ item }: { item: MenuItem }) {
  return (
    <Link href={item.href} className="group flex min-h-[64px] items-center gap-3 px-5 py-4 transition-colors hover:bg-bg/60">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold tracking-tight text-ink group-hover:text-brand">{item.label}</p>
        {item.description && <p className="mt-0.5 text-[13px] text-muted">{item.description}</p>}
      </div>
      {item.info && <span className={`nums shrink-0 text-[14px] font-semibold ${item.infoTone ?? "text-brand"}`}>{item.info}</span>}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}
