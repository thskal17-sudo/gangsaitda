"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError } from "@/components/auth-form";
import { deleteAccount } from "@/lib/auth-actions";
import { type DeleteAccountInput, deleteAccountSchema } from "@/lib/auth-schema";

export default function DeleteAccountForm() {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // 성공하면 서버가 바로 홈으로 보낸다. 돌아온 값이 있으면 실패다.
    const result = await deleteAccount(values);
    if (result) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="rounded-control bg-bg p-4 text-sm leading-relaxed text-ink">
        <p className="font-semibold">탈퇴하기 전에 확인해 주세요</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>이름·연락처·이메일 등 회원 정보가 바로 지워지고, <b className="text-ink">되돌릴 수 없어요.</b></li>
          <li>공고의 기관·마감일·지원 방법 등 회원 전용 정보를 더 볼 수 없어요.</li>
          <li>같은 이메일로 언제든 다시 가입할 수 있어요.</li>
        </ul>
      </div>

      <Field
        id="password"
        label="비밀번호 확인"
        type="password"
        autoComplete="current-password"
        hint="본인 확인을 위해 지금 쓰는 비밀번호를 입력해 주세요."
        error={errors.password?.message}
        {...register("password")}
      />

      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            aria-invalid={errors.confirmed ? true : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-warn"
            {...register("confirmed")}
          />
          <span className="text-sm font-semibold text-ink">위 내용을 확인했고, 탈퇴하겠습니다.</span>
        </label>
        {errors.confirmed && <p className="mt-1.5 pl-8 text-sm text-warn">{errors.confirmed.message}</p>}
      </div>

      <FormError message={serverError} />
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-14 w-full items-center justify-center rounded-control bg-warn text-[16px] font-semibold text-white transition-colors hover:bg-warn/90 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "처리 중…" : "회원 탈퇴"}
      </button>
    </form>
  );
}
