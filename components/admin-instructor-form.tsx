"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import { deleteInstructor, prepareInstructorUpload, saveInstructor } from "@/lib/admin-instructor-actions";
import { type AdminInstructorFormValues, adminInstructorSchema } from "@/lib/admin-instructor-schema";
import type { AdminProfile } from "@/lib/admin-profiles";
import { PROFILE_FIELDS, PROFILE_FILE_EXTENSIONS, PROFILE_FILE_MAX_BYTES, PROFILE_REGIONS, profileFileExtension } from "@/lib/profile-schema";

const ACCEPT = PROFILE_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/**
 * 관리자 · 강사 직접 등록 / 고치기 양식. 사이트에 가입하지 않은 강사를 운영자가 올린다.
 * 강사에게 기관 전달 동의를 받았다는 확인 체크가 있어야 저장된다.
 */
export default function AdminInstructorForm({ instructor }: { instructor: AdminProfile | null }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminInstructorFormValues>({
    resolver: zodResolver(adminInstructorSchema),
    defaultValues: {
      name: instructor?.name ?? "",
      phone: instructor?.phone ?? "",
      email: instructor?.email ?? "",
      fields: (instructor?.fields ?? []) as AdminInstructorFormValues["fields"],
      regions: (instructor?.regions ?? []) as AdminInstructorFormValues["regions"],
      consentNote: instructor?.consentNote ?? "",
      // 고칠 때는 이미 동의를 확인한 강사라 체크된 채로 시작한다
      consentAgreed: (instructor ? true : undefined) as true,
    },
  });

  const onPickFile = (picked: File | undefined) => {
    setFileError(undefined);
    setFile(null);
    if (!picked) return;
    if (!profileFileExtension(picked.name)) return setFileError("PDF, 파워포인트, 한글, 워드 파일만 올릴 수 있어요.");
    if (picked.size > PROFILE_FILE_MAX_BYTES) return setFileError("파일은 10MB 까지 올릴 수 있어요.");
    setFile(picked);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    if (!instructor && !file) return setFileError("프로필 파일을 골라 주세요.");

    let id = instructor?.memberId ?? null;
    let upload: { path: string; fileName: string } | undefined;
    if (file) {
      // 1) 올릴 자리 받기 → 2) 브라우저가 저장소에 바로 올리기
      const ticket = await prepareInstructorUpload(id, file.name, file.size);
      if ("error" in ticket) return setServerError(ticket.error);
      id = ticket.id;
      const res = await fetch(ticket.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
        body: file,
      }).catch(() => null);
      if (!res?.ok) return setServerError("파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      upload = { path: ticket.path, fileName: file.name };
    }
    if (!id) return setServerError("다시 시도해 주세요.");

    // 3) 저장
    const result = await saveInstructor(id, !instructor, values, upload);
    if ("error" in result) return setServerError(result.error);
    router.push("/admin/profiles?saved=1");
  });

  const onDelete = async () => {
    if (!instructor) return;
    if (!window.confirm(`${instructor.name} 강사님을 지울까요? 이 강사님의 추천 기록과 올린 파일도 함께 지워져요.`)) return;
    setDeleting(true);
    const result = await deleteInstructor(instructor.memberId);
    setDeleting(false);
    if ("error" in result) return setServerError(result.error);
    router.push("/admin/profiles?deleted=1");
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Section title="강사 정보">
        <Field id="name" label="이름" autoComplete="off" error={errors.name?.message} {...register("name")} />
        <Field
          id="phone"
          label="전화번호"
          inputMode="tel"
          autoComplete="off"
          placeholder="010-1234-5678"
          hint="운영자 확인용이에요. 기관에는 섭외가 확정된 뒤에만 보여요."
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Field
          id="email"
          label="이메일 (선택)"
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register("email")}
        />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">강의 분야 (여러 개 고를 수 있어요)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROFILE_FIELDS.map((field) => (
              <Chip key={field} value={field} label={field} {...register("fields")} />
            ))}
          </div>
          {errors.fields && <p className="mt-1.5 text-sm text-warn">{errors.fields.message}</p>}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">활동 가능 지역 (여러 개 고를 수 있어요)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROFILE_REGIONS.map((region) => (
              <Chip key={region} value={region} label={region} {...register("regions")} />
            ))}
          </div>
          {errors.regions && <p className="mt-1.5 text-sm text-warn">{errors.regions.message}</p>}
        </fieldset>
      </Section>

      <Section title="프로필 파일">
        {instructor?.fileName && !file && (
          <p className="rounded-control bg-bg px-4 py-3 text-sm text-ink">
            지금 올라가 있는 파일:{" "}
            <a href={`/admin/profiles/${instructor.memberId}/file`} className="break-all font-semibold text-brand hover:underline">
              {instructor.fileName}
            </a>
            <br />
            <span className="text-muted">바꾸려면 아래에서 새 파일을 고르세요.</span>
          </p>
        )}
        <div>
          <input
            id="profileFile"
            type="file"
            accept={ACCEPT}
            aria-label="프로필 파일"
            onChange={(e) => onPickFile(e.target.files?.[0])}
            aria-invalid={fileError ? true : undefined}
            className="block w-full rounded-control bg-bg p-3 text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          <p className="mt-1.5 text-xs text-muted">PDF·파워포인트·한글·워드, 10MB 까지. 기관이 그대로 내려받으니 연락처는 지운 파일이면 좋아요.</p>
          {fileError && <p className="mt-1.5 text-sm text-warn">{fileError}</p>}
        </div>
      </Section>

      <Section title="기관 전달 동의">
        <label className="flex cursor-pointer items-start gap-3 rounded-control bg-bg px-4 py-3.5">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-brand" {...register("consentAgreed")} />
          <span className="text-[15px] leading-relaxed text-ink">
            강사님께 <b>의뢰 기관에 프로필(이름·분야·지역·프로필 파일)을 전달하고, 섭외가 확정되면 연락처를 알리는 것</b>에 대해 동의를 받았어요.
          </span>
        </label>
        {errors.consentAgreed && <p className="-mt-2 text-sm text-warn">{errors.consentAgreed.message}</p>}
        <Field
          id="consentNote"
          label="동의 받은 방법 (선택)"
          autoComplete="off"
          placeholder="예) 10/16 카톡으로 동의"
          hint="나중에 확인할 수 있게 적어 두면 좋아요. 동의 확인 날짜는 자동으로 저장돼요."
          error={errors.consentNote?.message}
          {...register("consentNote")}
        />
      </Section>

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>{instructor ? "고친 내용 저장" : "강사 등록"}</SubmitButton>

      {instructor && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="h-12 text-sm font-semibold text-muted underline-offset-2 hover:text-warn hover:underline disabled:opacity-60"
        >
          {deleting ? "지우는 중…" : "이 강사 지우기"}
        </button>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card bg-white p-5 md:p-7">
      <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** 고르는 단추 모양의 체크박스 (강사 프로필 양식과 같은 모양) */
function Chip({ label, ...input }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" className="peer sr-only" {...input} />
      <span className="flex h-11 items-center rounded-badge bg-bg px-4 text-[15px] font-medium text-ink transition-colors peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">
        {label}
      </span>
    </label>
  );
}
