"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import { login } from "@/lib/auth-actions";
import { type LoginInput, loginSchema } from "@/lib/auth-schema";

export default function LoginForm({ next }: { next: string }) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // 성공하면 서버가 바로 next 주소로 보낸다. 돌아온 값이 있으면 실패다.
    const result = await login(values, next);
    if (result) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field
        id="email"
        label="이메일"
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <Field
        id="password"
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>로그인</SubmitButton>
    </form>
  );
}
