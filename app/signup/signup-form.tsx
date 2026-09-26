"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import PrivacyConsent, { SIGNUP_TERMS } from "@/components/privacy-consent";
import { signup } from "@/lib/auth-actions";
import { type SignupInput, signupSchema } from "@/lib/auth-schema";

export default function SignupForm({ next }: { next: string }) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // 성공하면 서버가 바로 next 주소로 보낸다. 돌아온 값이 있으면 실패다.
    const result = await signup(values, next);
    if (result) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="name" label="이름" autoComplete="name" error={errors.name?.message} {...register("name")} />
      <Field
        id="phone"
        label="연락처"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="010-1234-5678"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Field
        id="email"
        label="이메일"
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        hint="로그인할 때 씁니다."
        error={errors.email?.message}
        {...register("email")}
      />
      <Field
        id="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        hint="8자 이상"
        error={errors.password?.message}
        {...register("password")}
      />

      <PrivacyConsent terms={SIGNUP_TERMS} error={errors.privacyAgreed?.message} {...register("privacyAgreed")} />

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>무료로 가입하기</SubmitButton>
    </form>
  );
}
