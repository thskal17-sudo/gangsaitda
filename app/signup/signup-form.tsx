"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import PrivacyConsent, { SIGNUP_TERMS } from "@/components/privacy-consent";
import { signup } from "@/lib/auth-actions";
import { type SignupInput, signupSchema } from "@/lib/auth-schema";

/** 가입할 때 고르는 회원 종류 */
const TYPE_CHOICES = [
  { value: "강사", title: "강사", description: "공고를 보고 지원하고, 섭외받을 프로필을 올려요" },
  { value: "기관", title: "기관 담당자", description: "강사 섭외를 의뢰하고, 추천 강사를 받아요" },
] as const;

export default function SignupForm({ next }: { next: string }) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), defaultValues: { orgName: "" } });
  const memberType = useWatch({ control, name: "memberType" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // 성공하면 서버가 바로 next 주소로 보낸다. 돌아온 값이 있으면 실패다.
    const result = await signup(values, next);
    if (result) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset aria-describedby={errors.memberType ? "memberType-error" : undefined}>
        <legend className="text-sm font-semibold text-ink">어떤 회원으로 가입하세요?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TYPE_CHOICES.map((c) => (
            <label key={c.value} className="cursor-pointer">
              <input type="radio" value={c.value} className="peer sr-only" {...register("memberType")} />
              <span className="flex h-full flex-col rounded-control border-2 border-transparent bg-bg px-4 py-3.5 transition-colors peer-checked:border-brand peer-checked:bg-brand/5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">
                <span className="text-[17px] font-bold text-ink">{c.title}</span>
                <span className="mt-1 text-[13px] leading-snug text-muted">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.memberType && (
          <p id="memberType-error" className="mt-1.5 text-sm text-warn">
            {errors.memberType.message}
          </p>
        )}
      </fieldset>

      {memberType === "기관" && (
        <Field
          id="orgName"
          label="기관명"
          autoComplete="organization"
          placeholder="예) 부산OO중학교"
          hint="학교·기관 이름을 적어 주세요."
          error={errors.orgName?.message}
          {...register("orgName")}
        />
      )}
      <Field id="name" label={memberType === "기관" ? "담당자 이름" : "이름"} autoComplete="name" error={errors.name?.message} {...register("name")} />
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
