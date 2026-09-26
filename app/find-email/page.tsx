import type { Metadata } from "next";
import { AuthCard, AuthSwitchLink } from "@/components/auth-form";
import FindEmailForm from "./find-email-form";

export const metadata: Metadata = { title: "이메일 찾기" };

export default function FindEmailPage() {
  return (
    <AuthCard
      title="이메일 찾기"
      description="가입할 때 입력한 이름과 연락처를 적으면, 가입한 이메일(아이디)을 알려드립니다."
      footer={
        <>
          비밀번호가 생각나지 않으세요? <AuthSwitchLink href="/find-password">비밀번호 찾기</AuthSwitchLink>
        </>
      }
    >
      <FindEmailForm />
    </AuthCard>
  );
}
