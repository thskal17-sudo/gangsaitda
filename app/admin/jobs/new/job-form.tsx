"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton, TextAreaField } from "@/components/auth-form";
import { createJob } from "@/lib/admin-job-actions";
import { type JobInput, jobSchema } from "@/lib/admin-job-schema";
import { todayInSeoul } from "@/lib/date";

const EMPTY: JobInput = {
  title: "",
  organization: "",
  region: "",
  deadline: "",
  schedule: "",
  target: "",
  headcount: "",
  description: "",
  qualifications: "",
  documents: "",
  sourceUrl: "",
  applyUrl: "",
  applyEmail: "",
};

export default function JobForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<JobInput>({ resolver: zodResolver(jobSchema), defaultValues: EMPTY });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await createJob(values);
    if ("error" in result) {
      setServerError(result.error);
      throw new Error(result.error); // 저장 실패는 '성공'으로 치지 않는다 (버튼 다시 누를 수 있게).
    }
    // 목록으로 돌아가 방금 올린 공고를 알려준다.
    router.push(`/admin?created=${result.id}`);
  });

  return (
    <form onSubmit={(e) => onSubmit(e).catch(() => {})} noValidate className="flex flex-col gap-4">
      <Section title="기본 정보">
        <Field
          id="title"
          label="제목"
          placeholder="예) 방과후 코딩(스크래치) 강사 모집"
          hint="비회원에게도 보여요. 날짜·기간은 넣지 말고 수업 일정 칸에 적어 주세요."
          error={errors.title?.message}
          {...register("title")}
        />
        <Field id="organization" label="기관명" placeholder="예) 해운대초등학교" error={errors.organization?.message} {...register("organization")} />
        <Field id="region" label="지역" placeholder="예) 부산 해운대구" error={errors.region?.message} {...register("region")} />
        <Field id="deadline" label="마감일" type="date" min={todayInSeoul()} error={errors.deadline?.message} {...register("deadline")} />
      </Section>

      <Section title="수업">
        <TextAreaField
          id="schedule"
          label="수업 일정"
          rows={2}
          placeholder="예) 2026.10.6.~12.15. 매주 화·목 14:00~15:30 (10주)"
          error={errors.schedule?.message}
          {...register("schedule")}
        />
        <Field id="target" label="수업 대상 (선택)" placeholder="예) 초등 3~4학년 약 20명" error={errors.target?.message} {...register("target")} />
        <Field id="headcount" label="모집 인원 (선택)" inputMode="numeric" placeholder="예) 1" error={errors.headcount?.message} {...register("headcount")} />
        <TextAreaField
          id="description"
          label="상세 내용"
          rows={6}
          placeholder="수업 내용, 준비물, 강사료 외 안내 등. 줄바꿈이 그대로 보여요."
          error={errors.description?.message}
          {...register("description")}
        />
      </Section>

      <Section title="지원">
        <TextAreaField
          id="qualifications"
          label="지원 자격 (선택)"
          rows={3}
          placeholder={"한 줄에 하나씩 적어 주세요.\n예) 관련 자격증 소지자"}
          error={errors.qualifications?.message}
          {...register("qualifications")}
        />
        <Field id="documents" label="제출 서류 (선택)" placeholder="예) 이력서, 자격증 사본" error={errors.documents?.message} {...register("documents")} />
        <Field
          id="sourceUrl"
          label="원문 공고 주소 (선택)"
          type="url"
          inputMode="url"
          placeholder="https://"
          error={errors.sourceUrl?.message}
          {...register("sourceUrl")}
        />
        <Field
          id="applyUrl"
          label="지원서 링크 (선택)"
          type="url"
          inputMode="url"
          placeholder="https://"
          error={errors.applyUrl?.message}
          {...register("applyUrl")}
        />
        <Field
          id="applyEmail"
          label="지원 이메일 (선택)"
          type="email"
          placeholder="job@example.com"
          hint="링크·이메일이 둘 다 없으면 '원문 공고에서 지원 방법을 확인하세요'로 안내돼요."
          error={errors.applyEmail?.message}
          {...register("applyEmail")}
        />
      </Section>

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting || isSubmitSuccessful}>공고 올리기</SubmitButton>
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
