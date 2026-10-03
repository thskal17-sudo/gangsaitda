"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import { setNewPassword } from "@/lib/auth-actions";
import { type NewPasswordInput, newPasswordSchema } from "@/lib/auth-schema";
import type { RecoveryToken } from "@/lib/recovery";

export default function NewPasswordForm({ token }: { token: RecoveryToken }) {
  const [serverError, setServerError] = useState<string>();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await setNewPassword(values, token);
    if ("error" in result) setServerError(result.error);
    else setDone(true);
  });

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink">
        <p>
          <b>비밀번호를 바꿨어요.</b>
          <br />
          지금 로그인된 상태예요. 다음부터는 새 비밀번호로 로그인해 주세요.
        </p>
        <Link
          href="/jobs"
          className="flex h-14 items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90"
        >
          공고 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field
        id="password"
        label="새 비밀번호"
        type="password"
        autoComplete="new-password"
        hint="8자 이상"
        error={errors.password?.message}
        {...register("password")}
      />
      <Field
        id="passwordConfirm"
        label="새 비밀번호 확인"
        type="password"
        autoComplete="new-password"
        error={errors.passwordConfirm?.message}
        {...register("passwordConfirm")}
      />
      <FormError message={serverError} />
      {serverError?.includes("링크가 만료") && (
        <Link href="/find-password" className="text-center text-sm font-semibold text-brand underline-offset-2 hover:underline">
          메일 다시 받기
        </Link>
      )}
      <SubmitButton pending={isSubmitting}>비밀번호 바꾸기</SubmitButton>
    </form>
  );
}
