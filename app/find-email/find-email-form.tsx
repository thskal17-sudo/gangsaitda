"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import { findEmail } from "@/lib/auth-actions";
import { type FindEmailInput, findEmailSchema } from "@/lib/auth-schema";

export default function FindEmailForm() {
  const [serverError, setServerError] = useState<string>();
  const [emails, setEmails] = useState<string[] | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FindEmailInput>({ resolver: zodResolver(findEmailSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    setEmails(null);
    const result = await findEmail(values);
    if ("error" in result) setServerError(result.error);
    else setEmails(result.emails);
  });

  return (
    <div className="flex flex-col gap-5">
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
        <FormError message={serverError} />
        <SubmitButton pending={isSubmitting}>이메일 찾기</SubmitButton>
      </form>

      {emails && <Result emails={emails} />}
    </div>
  );
}

function Result({ emails }: { emails: string[] }) {
  if (emails.length === 0) {
    return (
      <p role="status" className="rounded-control bg-bg px-4 py-4 text-sm leading-relaxed text-ink">
        입력하신 이름·연락처로 가입된 이메일이 없습니다. 가입할 때 적은 그대로 입력했는지 확인해 주세요.
      </p>
    );
  }

  return (
    <div role="status" className="rounded-control bg-brand/8 px-4 py-4">
      <p className="text-sm text-muted">가입하신 이메일</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {emails.map((email) => (
          <li key={email} className="text-[18px] font-bold tracking-tight text-ink">
            {email}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">개인정보 보호를 위해 일부를 가려서 보여드립니다.</p>
      <Link
        href="/login"
        className="mt-4 flex h-12 items-center justify-center rounded-control bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand/90"
      >
        로그인하러 가기
      </Link>
    </div>
  );
}
