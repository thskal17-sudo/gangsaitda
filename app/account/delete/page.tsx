import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-form";
import { getCurrentMember } from "@/lib/member";
import DeleteAccountForm from "./delete-account-form";

export const metadata: Metadata = { title: "회원 탈퇴", robots: { index: false, follow: false } };

/** 회원 탈퇴. 로그인한 회원만. 비밀번호로 본인 확인 후 계정과 회원 정보를 지운다. */
export default async function DeleteAccountPage() {
  if (!(await getCurrentMember())) redirect("/login?next=/account/delete");

  return (
    <AuthCard
      title="회원 탈퇴"
      description="탈퇴하면 계정과 회원 정보가 바로 지워져요."
      footer={
        <>
          탈퇴하지 않으려면 <Link href="/" className="font-semibold text-brand underline-offset-2 hover:underline">홈으로</Link> 돌아가세요.
        </>
      }
    >
      <DeleteAccountForm />
    </AuthCard>
  );
}
