"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import { requestPasswordReset } from "@/lib/auth-actions";
import { type ResetRequestInput, resetRequestSchema } from "@/lib/auth-schema";

export default function FindPasswordForm() {
  const [serverError, setServerError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetRequestInput>({ resolver: zodResolver(resetRequestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await requestPasswordReset(values);
    if ("error" in result) setServerError(result.error);
    else setSentTo(values.email.trim());
  });

  // 가입 여부와 상관없이 같은 안내를 보여준다 (남이 가입 여부를 알아낼 수 없게).
  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink">
        <p>
          <b className="break-all">{sentTo}</b>
          <br />
          으로 비밀번호를 다시 정하는 메일을 보냈어요.
        </p>
        <ul className="list-disc space-y-1 rounded-control bg-bg py-4 pr-4 pl-9 text-sm text-muted">
          <li>가입한 이메일이면 1~2분 안에 도착해요.</li>
          <li>메일이 안 보이면 <b className="text-ink">스팸함</b>도 확인해 주세요.</li>
          <li>메일 속 링크는 <b className="text-ink">1시간 동안, 한 번만</b> 쓸 수 있어요.</li>
        </ul>
        <button
          type="button"
          onClick={() => setSentTo(undefined)}
          className="flex h-14 items-center justify-center rounded-control bg-bg text-[16px] font-semibold text-ink transition-colors hover:bg-line"
        >
          다른 이메일로 다시 받기
        </button>
        <Link href="/login" className="text-center text-sm font-semibold text-brand underline-offset-2 hover:underline">
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field
        id="email"
        label="가입한 이메일"
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>재설정 메일 받기</SubmitButton>
    </form>
  );
}
