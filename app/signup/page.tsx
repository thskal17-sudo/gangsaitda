import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthSwitchLink } from "@/components/auth-form";
import { getCurrentMember } from "@/lib/member";
import { safeNext } from "@/lib/safe-next";
import SignupForm from "./signup-form";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNext((await searchParams).next);

  // 이미 로그인한 회원은 가입 화면을 볼 필요가 없으니 가려던 곳으로 보낸다.
  if (await getCurrentMember()) redirect(next);

  return (
    <AuthCard
      title="회원가입"
      description="가입하면 공고의 강사료·수업 일정·지원 방법을 볼 수 있습니다. 가입은 무료입니다."
      footer={
        <>
          이미 회원이세요? <AuthSwitchLink href="/login" next={next}>로그인</AuthSwitchLink>
        </>
      }
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}
