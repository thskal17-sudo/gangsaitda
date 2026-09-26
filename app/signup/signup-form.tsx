"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
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

      <PrivacyConsent error={errors.privacyAgreed?.message} {...register("privacyAgreed")} />

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>무료로 가입하기</SubmitButton>
    </form>
  );
}

/** 개인정보 수집·이용 동의 (필수). 무엇을 왜 얼마나 보관하는지 펼쳐 볼 수 있다. */
function PrivacyConsent({ error, ...checkbox }: { error?: string } & UseFormRegisterReturn) {
  return (
    <div className={`rounded-control border-2 bg-bg p-4 ${error ? "border-warn" : "border-transparent"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "privacy-error" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          {...checkbox}
        />
        <span className="text-sm font-semibold text-ink">
          <span className="text-warn">[필수]</span> 개인정보 수집·이용에 동의합니다
        </span>
      </label>

      <details className="group mt-2 pl-8 text-sm text-muted">
        <summary className="cursor-pointer list-none font-medium underline underline-offset-2">
          <span className="group-open:hidden">내용 보기</span>
          <span className="hidden group-open:inline">내용 접기</span>
        </summary>
        <dl className="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 leading-relaxed">
          <dt className="font-medium text-ink">수집 항목</dt>
          <dd>이름, 연락처, 이메일</dd>
          <dt className="font-medium text-ink">이용 목적</dt>
          <dd>회원 확인, 공고 상세 정보 제공, 서비스 이용 관련 안내 및 문의 응대</dd>
          <dt className="font-medium text-ink">보관 기간</dt>
          <dd>회원 탈퇴 시까지 (법령에 따라 보관해야 하는 경우 그 기간까지)</dd>
        </dl>
        <p className="mt-2 leading-relaxed">
          동의를 거부할 수 있으나, 거부하면 회원가입을 할 수 없습니다. 광고·홍보 메시지는 보내지 않습니다.
        </p>
      </details>

      {error && (
        <p id="privacy-error" className="mt-2 pl-8 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
