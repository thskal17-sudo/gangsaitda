import type { Metadata } from "next";
import { AuthCard, AuthSwitchLink } from "@/components/auth-form";
import FindPasswordForm from "./find-password-form";

export const metadata: Metadata = { title: "비밀번호 찾기" };

/**
 * 비밀번호 찾기. 가입한 이메일을 넣으면 비밀번호를 다시 정하는 메일이 간다.
 * 메일이 안 되는 비상시에는 운영자가 supabase/admin-reset-password.sql 로 임시 비밀번호를 정해 준다.
 */
export default function FindPasswordPage() {
  return (
    <AuthCard
      title="비밀번호 찾기"
      description="가입한 이메일로 비밀번호를 다시 정하는 링크를 보내 드려요."
      footer={
        <>
          이메일(아이디)이 생각나지 않으세요? <AuthSwitchLink href="/find-email">이메일 찾기</AuthSwitchLink>
        </>
      }
    >
      <FindPasswordForm />
    </AuthCard>
  );
}
