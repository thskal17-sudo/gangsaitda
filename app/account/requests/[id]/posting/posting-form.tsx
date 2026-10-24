"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton, TextAreaField } from "@/components/auth-form";
import { todayInSeoul } from "@/lib/date";
import { saveMyPosting } from "@/lib/my-posting-actions";
import { type PostingInput, postingSchema } from "@/lib/posting-schema";

/**
 * 강사 모집 공고 쓰기 양식. 처음에는 의뢰 내용으로 미리 채워져 있고(lib/posting-schema.ts 의 prefillPosting),
 * 반려된 공고를 고칠 때는 전에 쓴 내용이 채워진다. 저장하면 운영자 검토로 넘어간다.
 */
export default function PostingForm({ requestId, values, resubmit }: { requestId: string; values: PostingInput; resubmit: boolean }) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PostingInput>({ resolver: zodResolver(postingSchema), defaultValues: values });

  const onSubmit = handleSubmit(async (input) => {
    setServerError(undefined);
    // 성공하면 서버가 의뢰 화면으로 보낸다. 돌아온 값이 있으면 실패다.
    const result = await saveMyPosting(requestId, input);
    if (result) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-card bg-white p-5 md:p-7">
        <Field
          id="title"
          label="공고 제목"
          placeholder="예) 새솔초등학교 방과후 코딩 강사 모집"
          hint="비회원에게도 보여요. 기관명과 과목을 넣으면 찾기 쉬워요."
          error={errors.title?.message}
          {...register("title")}
        />
        <Field id="deadline" label="지원 마감일" type="date" min={todayInSeoul()} error={errors.deadline?.message} {...register("deadline")} />
        <TextAreaField
          id="description"
          label="공고 내용"
          rows={12}
          hint="의뢰 내용으로 미리 채워 뒀어요. 강사님이 알아야 할 내용을 자유롭게 고쳐 주세요. 담당자 연락처는 적지 않아도 돼요."
          error={errors.description?.message}
          {...register("description")}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-card bg-white p-5 md:p-7">
        <h2 className="text-[17px] font-bold tracking-tight text-ink">
          더 적을 것 <span className="text-[14px] font-medium text-muted">(선택)</span>
        </h2>
        <TextAreaField
          id="qualifications"
          label="지원 자격"
          rows={3}
          placeholder={"예) 코딩 교육 경력 1년 이상\n관련 자격증 우대"}
          hint="한 줄에 하나씩 적으면 목록으로 보여요."
          error={errors.qualifications?.message}
          {...register("qualifications")}
        />
        <Field
          id="documents"
          label="제출 서류"
          placeholder="예) 이력서, 자격증 사본"
          error={errors.documents?.message}
          {...register("documents")}
        />
      </section>

      <div className="rounded-card bg-brand/8 px-5 py-4 text-[14px] leading-relaxed text-ink">
        <b>저장하면 운영자가 검토해요.</b> 승인되면 공고 목록에 올라가고, 기관명·지역·일정은 의뢰서에 적은 대로 함께 보여요.
        담당자 이름·연락처·이메일은 공고에 나오지 않아요. 지원은 강사잇다가 받아 프로필을 전달해 드려요.
      </div>

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>{resubmit ? "고쳐서 다시 검토 요청하기" : "검토 요청하기"}</SubmitButton>
    </form>
  );
}
