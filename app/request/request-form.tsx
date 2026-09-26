"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton, TextAreaField } from "@/components/auth-form";
import PrivacyConsent, { REQUEST_TERMS } from "@/components/privacy-consent";
import { sendRequest } from "@/lib/request-actions";
import { ORG_TYPES, type RequestInput, requestSchema } from "@/lib/request-schema";

const EMPTY: Partial<RequestInput> = {
  orgName: "",
  region: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  subject: "",
  schedule: "",
  target: "",
  headcount: "",
  budget: "",
  message: "",
  website: "",
};

export default function RequestForm() {
  const [serverError, setServerError] = useState<string>();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestInput>({ resolver: zodResolver(requestSchema), defaultValues: EMPTY });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await sendRequest(values);
    if ("error" in result) {
      setServerError(result.error);
      return;
    }
    reset(EMPTY);
    setSent(true);
    window.scrollTo({ top: 0 });
  });

  if (sent) return <Sent onAgain={() => setSent(false)} />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Section title="기관 정보">
        <Field id="orgName" label="기관명" placeholder="예) 새솔초등학교" error={errors.orgName?.message} {...register("orgName")} />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">기관 종류</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ORG_TYPES.map((type) => (
              <label key={type} className="cursor-pointer">
                <input type="radio" value={type} className="peer sr-only" {...register("orgType")} />
                <span className="flex h-11 items-center rounded-badge bg-bg px-4 text-[15px] font-medium text-ink transition-colors peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">
                  {type}
                </span>
              </label>
            ))}
          </div>
          {errors.orgType && <p className="mt-1.5 text-sm text-warn">{errors.orgType.message}</p>}
        </fieldset>
        <Field id="region" label="지역" placeholder="예) 부산 해운대구" error={errors.region?.message} {...register("region")} />
      </Section>

      <Section title="담당자">
        <Field id="contactName" label="담당자 이름" autoComplete="name" error={errors.contactName?.message} {...register("contactName")} />
        <Field
          id="contactPhone"
          label="연락처"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="010-1234-5678"
          error={errors.contactPhone?.message}
          {...register("contactPhone")}
        />
        <Field
          id="contactEmail"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          error={errors.contactEmail?.message}
          {...register("contactEmail")}
        />
      </Section>

      <Section title="필요한 강사">
        <Field
          id="subject"
          label="필요한 분야·과목"
          placeholder="예) 방과후 코딩, 신입사원 CS 교육"
          error={errors.subject?.message}
          {...register("subject")}
        />
        <TextAreaField
          id="schedule"
          label="희망 일정"
          rows={2}
          placeholder="예) 10월~12월, 매주 화·목 오후 2시~3시 30분"
          error={errors.schedule?.message}
          {...register("schedule")}
        />
        <Field id="target" label="수업 대상 (선택)" placeholder="예) 초등 3~4학년 20명" error={errors.target?.message} {...register("target")} />
        <Field
          id="headcount"
          label="필요한 강사 수 (선택)"
          inputMode="numeric"
          placeholder="예) 1"
          error={errors.headcount?.message}
          {...register("headcount")}
        />
        <Field id="budget" label="예산·강사료 (선택)" placeholder="예) 시간당 40,000원" error={errors.budget?.message} {...register("budget")} />
        <TextAreaField
          id="message"
          label="요청 사항 (선택)"
          placeholder="예) 관련 자격증이 있는 강사를 원합니다."
          error={errors.message?.message}
          {...register("message")}
        />
      </Section>

      {/* 사람에게는 안 보이는 칸 (자동 광고 글 막기) */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">웹사이트</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <PrivacyConsent terms={REQUEST_TERMS} error={errors.privacyAgreed?.message} {...register("privacyAgreed")} />
      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>의뢰 보내기</SubmitButton>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card bg-white p-5 md:p-7">
      <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Sent({ onAgain }: { onAgain: () => void }) {
  return (
    <section role="status" className="rounded-card bg-white p-6 text-center md:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-badge bg-brand/12 text-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h2 className="mt-4 text-[20px] font-bold tracking-tight text-ink">의뢰가 접수되었습니다</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        내용을 확인한 뒤 담당자 연락처로 연락드리겠습니다.
      </p>
      <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
        <Link
          href="/jobs"
          className="flex h-14 items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90"
        >
          공고 둘러보기
        </Link>
        <button
          type="button"
          onClick={onAgain}
          className="flex h-14 items-center justify-center rounded-control bg-bg text-[16px] font-semibold text-ink transition-colors hover:bg-line"
        >
          의뢰 하나 더 보내기
        </button>
      </div>
    </section>
  );
}
