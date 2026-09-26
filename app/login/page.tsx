import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthSwitchLink } from "@/components/auth-form";
import { getCurrentMember } from "@/lib/member";
import { safeNext } from "@/lib/safe-next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);

  // 이미 로그인한 회원은 가려던 곳으로 보낸다.
  if (await getCurrentMember()) redirect(next);

  return (
    <AuthCard
      title="로그인"
      description="가입할 때 입력한 이메일과 비밀번호로 로그인합니다."
      footer={
        <>
          아직 회원이 아니세요? <AuthSwitchLink href="/signup" next={next}>무료 회원가입</AuthSwitchLink>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
