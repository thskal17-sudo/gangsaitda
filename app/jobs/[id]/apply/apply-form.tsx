"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { prepareApplyUpload, submitApplication } from "@/lib/apply-actions";
import { type ApplyInput, type ApplyUpload, applySchema } from "@/lib/apply-schema";
import { FormError, SubmitButton, TextAreaField } from "@/components/auth-form";
import PrivacyConsent, { APPLY_TERMS } from "@/components/privacy-consent";
import { REQUEST_FILE_ACCEPT, REQUEST_FILE_MAX_BYTES, requestFileExtension } from "@/lib/request-files";

type Kind = "profile" | "plan";

/**
 * 공고 지원 양식. 등록해 둔 프로필이 있으면 함께 가고, 프로필 파일·강의계획서 파일을 올릴 수 있다 (셋 중 하나는 꼭).
 * 파일은 지원 버튼을 눌렀을 때 브라우저가 저장소에 바로 올린 뒤, 지원을 보낸다.
 */
export default function ApplyForm({
  jobId,
  profile,
}: {
  jobId: string;
  /** 등록해 둔 프로필 (없으면 null) */
  profile: { savedDate: string; method: "form" | "file"; fileName?: string } | null;
}) {
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [fileError, setFileError] = useState<Partial<Record<Kind, string>>>({});
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyInput>({ resolver: zodResolver(applySchema), defaultValues: { message: "" } });

  const pick = (kind: Kind, picked: File | undefined) => {
    setFileError((e) => ({ ...e, [kind]: undefined }));
    if (!picked) return setFiles((f) => ({ ...f, [kind]: undefined }));
    if (!requestFileExtension(picked.name)) return setFileError((e) => ({ ...e, [kind]: "PDF, 한글, 워드, 파워포인트, 사진(JPG·PNG) 파일만 올릴 수 있어요." }));
    if (picked.size > REQUEST_FILE_MAX_BYTES) return setFileError((e) => ({ ...e, [kind]: "파일은 10MB 까지 올릴 수 있어요." }));
    setFiles((f) => ({ ...f, [kind]: picked }));
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    if (!profile && !files.profile && !files.plan) {
      return setServerError("등록한 프로필이 없어요. 프로필 파일이나 강의계획서 중 하나는 올려 주세요.");
    }
    // 1) 고른 파일마다 올릴 자리 받기 → 브라우저가 저장소에 바로 올리기
    const uploads: { profile?: ApplyUpload; plan?: ApplyUpload } = {};
    for (const kind of ["profile", "plan"] as const) {
      const file = files[kind];
      if (!file) continue;
      const ticket = await prepareApplyUpload(jobId, kind, file.name, file.size);
      if ("error" in ticket) return setServerError(ticket.error);
      const res = await fetch(ticket.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
        body: file,
      }).catch(() => null);
      if (!res?.ok) return setServerError("파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      uploads[kind] = { path: ticket.path, fileName: file.name };
    }
    // 2) 지원 보내기 (성공하면 서버가 공고 화면으로 보낸다)
    const result = await submitApplication(jobId, values, uploads);
    if (result) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-card bg-white p-5 md:p-7">
        <h2 className="text-[17px] font-bold tracking-tight text-ink">기관에 보낼 것</h2>
        {profile ? (
          <p className="rounded-control bg-ok/10 px-4 py-3 text-[14px] leading-relaxed text-ink">
            <b className="text-ok">등록해 둔 내 프로필이 함께 전달돼요.</b>{" "}
            <span className="nums text-muted">
              ({profile.method === "file" ? `파일 · ${profile.fileName ?? "프로필 파일"}` : "양식으로 작성"} · {profile.savedDate} 저장)
            </span>
            <br />
            <Link href="/account/profile" className="font-semibold text-brand hover:underline">
              프로필 고치기
            </Link>
          </p>
        ) : (
          <p className="rounded-control bg-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
            등록한 프로필이 없어요. 아래에서 <b>프로필 파일이나 강의계획서 중 하나는</b> 꼭 올려 주세요.
            <br />
            <Link href="/account/profile" className="font-semibold text-brand hover:underline">
              내 프로필을 등록해 두면
            </Link>{" "}
            다음부터는 파일 없이도 지원할 수 있어요.
          </p>
        )}

        <FilePicker
          id="profileFile"
          kind="profile"
          label={profile ? "프로필 파일 더 보내기 (선택)" : "프로필 파일"}
          hint="이력서·경력기술서 등. PDF, 한글, 워드, 파워포인트, 사진 · 10MB 까지"
          file={files.profile}
          error={fileError.profile}
          onPick={pick}
        />
        <FilePicker
          id="planFile"
          kind="plan"
          label="강의계획서 (선택)"
          hint="이 공고에 맞춰 준비한 강의계획서가 있으면 함께 보내요."
          file={files.plan}
          error={fileError.plan}
          onPick={pick}
        />
        <TextAreaField
          id="message"
          label="기관에 한마디 (선택)"
          rows={3}
          placeholder="예) 중학생 대상 메이커 수업을 3년째 하고 있어요. 장비 세팅부터 직접 해 드릴 수 있어요."
          error={errors.message?.message}
          {...register("message")}
        />
      </section>

      <PrivacyConsent
        terms={APPLY_TERMS}
        label="이 공고를 올린 기관에 내 지원 정보를 전달하는 데 동의합니다"
        error={errors.shareAgreed?.message}
        {...register("shareAgreed")}
      />

      <div className="rounded-card bg-brand/8 px-5 py-4 text-[14px] leading-relaxed text-ink">
        지원하면 기관 담당자가 프로필과 파일을 보고 골라요. <b>연락처는 섭외가 확정된 뒤에만</b> 기관에 알려요. 한 공고에 한 번만 지원할 수 있어요.
      </div>

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>{isSubmitting ? "지원 보내는 중…" : "지원하기"}</SubmitButton>
    </form>
  );
}

/** 파일 고르기 한 칸: 고른 파일 이름과 '바꾸기·빼기' */
function FilePicker({
  id,
  kind,
  label,
  hint,
  file,
  error,
  onPick,
}: {
  id: string;
  kind: Kind;
  label: string;
  hint: string;
  file?: File;
  error?: string;
  onPick: (kind: Kind, file: File | undefined) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className={`mt-2 flex min-h-14 items-center gap-3 rounded-control border-2 bg-bg px-4 py-2 ${error ? "border-warn" : "border-transparent"}`}>
        <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{file ? file.name : <span className="text-muted/70">파일을 골라 주세요</span>}</span>
        <input
          id={id}
          type="file"
          accept={REQUEST_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => onPick(kind, e.target.files?.[0])}
        />
        {file && (
          <button type="button" onClick={() => onPick(kind, undefined)} className="shrink-0 text-[13px] font-semibold text-muted hover:text-warn">
            빼기
          </button>
        )}
        <label htmlFor={id} className="flex h-9 shrink-0 cursor-pointer items-center rounded-control bg-white px-3 text-[13px] font-semibold text-brand hover:bg-brand/10">
          {file ? "바꾸기" : "파일 고르기"}
        </label>
      </div>
      {error ? <p className="mt-1.5 text-sm text-warn">{error}</p> : <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
