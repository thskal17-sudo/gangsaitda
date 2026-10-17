import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MemberTypeNotice from "@/components/member-type-notice";
import { formatKoreanDate, seoulDateOf } from "@/lib/date";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { getMyProfile } from "@/lib/profile";
import ProfileForm from "./profile-form";

export const metadata: Metadata = { title: "내 프로필", robots: { index: false, follow: false } };

/**
 * 강사 프로필. 강사 회원만 (기관 회원에게는 안내만). 기관 전달에 동의한 강사만 낸다 (원하는 사람만).
 * 기관에서 강사섭외 의뢰가 들어오면 운영자가 맞는 프로필을 골라 그 기관에 전달한다.
 */
export default async function ProfilePage() {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/account/profile");
  if ((await getMemberType()) === "기관") {
    return (
      <section className="mx-auto w-full max-w-[560px]">
        <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">내 프로필</h1>
        <div className="mt-5">
          <MemberTypeNotice need="강사" />
        </div>
      </section>
    );
  }
  const profile = await getMyProfile(member.id);

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">내 프로필</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        학교·기관에서 강사섭외 의뢰가 들어오면, 의뢰에 맞는 강사님의 프로필을 운영자가 골라 기관에 전달해요.
        <br />
        원하는 강사님만 내시면 되고, 언제든 고치거나 지울 수 있어요.
      </p>
      {profile && (
        <p className="nums mt-4 inline-flex rounded-badge bg-ok/10 px-3 py-1 text-sm font-semibold text-ok">
          제출됨 · {formatKoreanDate(seoulDateOf(profile.updatedAt))} 저장
        </p>
      )}
      <div className="mt-5">
        <ProfileForm profile={profile} />
      </div>
    </section>
  );
}
