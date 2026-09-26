import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthSwitchLink } from "@/components/auth-form";
import { SUPPORT_CONTACT } from "@/lib/site";

export const metadata: Metadata = { title: "비밀번호 찾기" };

/**
 * 비밀번호 찾기. 메일 보내기 설정(도메인 구입 뒤)을 하기 전까지는 운영자에게 문의하도록 안내한다.
 * 운영자는 supabase/admin-reset-password.sql 로 임시 비밀번호를 정해 준다.
 */
export default function FindPasswordPage() {
  return (
    <AuthCard
      title="비밀번호 찾기"
      description="비밀번호를 메일로 다시 정하는 기능은 준비 중입니다."
      footer={
        <>
          이메일(아이디)이 생각나지 않으세요? <AuthSwitchLink href="/find-email">이메일 찾기</AuthSwitchLink>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink">
        <p>
          지금은 <b>운영자에게 문의</b>해 주시면 임시 비밀번호를 정해 드립니다.
          <br />
          문의하실 때 <b>가입한 이메일, 이름, 연락처</b>를 함께 알려 주세요. 본인인지 확인한 뒤 처리해 드립니다.
        </p>
        <div className="rounded-control bg-bg px-4 py-4">
          <p className="text-sm text-muted">문의처</p>
          <p className="mt-1 text-[17px] font-bold tracking-tight break-all">
            {SUPPORT_CONTACT ?? "준비 중입니다"}
          </p>
        </div>
        <Link
          href="/login"
          className="flex h-14 items-center justify-center rounded-control bg-bg text-[16px] font-semibold text-ink transition-colors hover:bg-line"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </AuthCard>
  );
}
