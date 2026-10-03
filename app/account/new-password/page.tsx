import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AuthCard } from "@/components/auth-form";
import { RECOVERY_COOKIE } from "@/lib/recovery";
import NewPasswordForm from "./new-password-form";

export const metadata: Metadata = { title: "새 비밀번호", robots: { index: false, follow: false } };

/**
 * 새 비밀번호 정하기. 비밀번호 재설정 메일 속 링크가 여는 화면.
 * 링크의 값(token_hash 또는 code)은 여기서 쓰지 않고 '비밀번호 바꾸기'를 누를 때 서버로 보낸다 (lib/auth-actions.ts).
 */
export default async function NewPasswordPage({ searchParams }: PageProps<"/account/new-password">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : undefined;
  const code = typeof params.code === "string" ? params.code : undefined;
  const canSet = Boolean(tokenHash || code) || (await cookies()).has(RECOVERY_COOKIE);

  return (
    <AuthCard
      title="새 비밀번호"
      description="앞으로 쓸 비밀번호를 정해 주세요."
      footer={
        <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      {canSet ? (
        <NewPasswordForm token={{ tokenHash, code }} />
      ) : (
        <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink">
          <p>이 화면은 비밀번호 재설정 메일 속 링크로 들어와야 쓸 수 있어요.</p>
          <Link
            href="/find-password"
            className="flex h-14 items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90"
          >
            재설정 메일 받기
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
