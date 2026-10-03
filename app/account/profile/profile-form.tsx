"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormError, SubmitButton, TextAreaField } from "@/components/auth-form";
import PrivacyConsent, { PROFILE_SHARE_TERMS, PROFILE_TERMS } from "@/components/privacy-consent";
import type { Profile } from "@/lib/profile";
import { deleteProfile, prepareProfileUpload, saveProfile } from "@/lib/profile-actions";
import {
  PROFILE_FILE_EXTENSIONS,
  PROFILE_FIELDS,
  PROFILE_FILE_MAX_BYTES,
  PROFILE_REGIONS,
  type ProfileInput,
  profileFileExtension,
  profileSchema,
} from "@/lib/profile-schema";

const ACCEPT = PROFILE_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export default function ProfileForm({ profile }: { profile: Profile | null }) {
  const [serverError, setServerError] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fields: (profile?.fields ?? []) as ProfileInput["fields"],
      regions: (profile?.regions ?? []) as ProfileInput["regions"],
      method: profile?.method ?? "form",
      career: profile?.career ?? "",
      certificates: profile?.certificates ?? "",
      intro: profile?.intro ?? "",
    },
  });
  const method = useWatch({ control, name: "method" });

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
    setSaved(false);

    let upload: { path: string; fileName: string } | undefined;
    if (values.method === "file") {
      if (!file && !profile?.filePath) return setFileError("프로필 파일을 골라 주세요.");
      if (file) {
        // 1) 올릴 자리 받기 → 2) 브라우저가 저장소에 바로 올리기
        const ticket = await prepareProfileUpload(file.name, file.size);
        if ("error" in ticket) return setServerError(ticket.error);
        const res = await fetch(ticket.signedUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
          body: file,
        }).catch(() => null);
        if (!res?.ok) return setServerError("파일을 올리지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
        upload = { path: ticket.path, fileName: file.name };
      }
    }

    // 3) 프로필 저장
    const result = await saveProfile(values, upload);
    if ("error" in result) return setServerError(result.error);
    setFile(null);
    setSaved(true);
    window.scrollTo({ top: 0 });
  });

  const onDelete = async () => {
    if (!window.confirm("프로필을 지우면 기관에 전달되지 않아요. 올린 파일도 함께 지워져요. 지울까요?")) return;
    setDeleting(true);
    const result = await deleteProfile();
    setDeleting(false);
    if ("error" in result) setServerError(result.error);
    else window.location.reload();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {saved && (
        <p role="status" className="rounded-card bg-ok/10 px-5 py-4 text-[15px] font-semibold text-ok">
          프로필을 저장했어요. 기관 의뢰가 들어오면 운영자가 확인해 전달해 드릴게요.
        </p>
      )}

      <Section title="기본 정보">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">강의 분야 (여러 개 고를 수 있어요)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROFILE_FIELDS.map((field) => (
              <Chip key={field} type="checkbox" value={field} label={field} {...register("fields")} />
            ))}
          </div>
          {errors.fields && <p className="mt-1.5 text-sm text-warn">{errors.fields.message}</p>}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">활동 가능 지역 (여러 개 고를 수 있어요)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROFILE_REGIONS.map((region) => (
              <Chip key={region} type="checkbox" value={region} label={region} {...register("regions")} />
            ))}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            경기권: 서울·경기·인천 · 충청권: 대전·세종·충북·충남 · 전라권: 광주·전북·전남 · 경상권: 부산·울산·대구·경남·경북
          </p>
          {errors.regions && <p className="mt-1.5 text-sm text-warn">{errors.regions.message}</p>}
        </fieldset>
      </Section>

      <Section title="프로필 내는 방법">
        <div className="flex flex-wrap gap-2">
          <Chip type="radio" value="form" label="강사잇다 양식으로 작성" {...register("method")} />
          <Chip type="radio" value="file" label="내 파일 올리기" {...register("method")} />
        </div>

        {method === "form" ? (
          <>
            <TextAreaField
              id="career"
              label="강의 경력"
              placeholder={"예) 2023~ 부산 ○○초 방과후 코딩 강사\n2022 ○○구청 청소년 진로캠프 강의 (4회)"}
              hint="최근 경력부터 한 줄에 하나씩 적어 주세요."
              rows={6}
              error={errors.career?.message}
              {...register("career")}
            />
            <TextAreaField
              id="certificates"
              label="자격·학력 (선택)"
              placeholder="예) 정보처리기사, 진로지도사 2급"
              rows={3}
              error={errors.certificates?.message}
              {...register("certificates")}
            />
            <TextAreaField
              id="intro"
              label="자기소개 (선택)"
              placeholder="예) 아이들이 직접 만들며 배우는 수업을 합니다."
              rows={3}
              error={errors.intro?.message}
              {...register("intro")}
            />
          </>
        ) : (
          <div>
            <label htmlFor="profileFile" className="block text-sm font-semibold text-ink">
              프로필 파일
            </label>
            {profile?.fileName && !file && (
              <p className="mt-2 rounded-control bg-bg px-4 py-3 text-sm text-ink">
                지금 올라가 있는 파일: <b className="break-all">{profile.fileName}</b>
                <br />
                <span className="text-muted">바꾸려면 아래에서 새 파일을 고르세요.</span>
              </p>
            )}
            <input
              id="profileFile"
              type="file"
              accept={ACCEPT}
              onChange={(e) => onPickFile(e.target.files?.[0])}
              aria-invalid={fileError ? true : undefined}
              className="mt-2 block w-full rounded-control bg-bg p-3 text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-1.5 text-xs text-muted">PDF·파워포인트·한글·워드, 10MB 까지</p>
            {fileError && <p className="mt-1.5 text-sm text-warn">{fileError}</p>}
          </div>
        )}

        <p className="rounded-control bg-accent/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <b>전화번호·이메일은 빼고</b> 작성해 주세요. 연락처는 섭외가 확정된 뒤에만 기관에 알려 드려요.
        </p>
      </Section>

      <PrivacyConsent
        terms={PROFILE_TERMS}
        label="프로필 수집·이용에 동의합니다"
        error={errors.collectAgreed?.message}
        {...register("collectAgreed")}
      />
      <PrivacyConsent
        terms={PROFILE_SHARE_TERMS}
        label="의뢰가 들어오면 기관에 프로필을 전달하는 데 동의합니다"
        error={errors.shareAgreed?.message}
        {...register("shareAgreed")}
      />

      <FormError message={serverError} />
      <SubmitButton pending={isSubmitting}>{profile ? "프로필 고치기" : "프로필 내기"}</SubmitButton>

      {profile && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="h-12 text-sm font-semibold text-muted underline-offset-2 hover:text-warn hover:underline disabled:opacity-60"
        >
          {deleting ? "지우는 중…" : "프로필 지우기 (기관 전달 동의 철회)"}
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

/** 고르는 단추 모양의 체크박스·라디오 (요청서의 '기관 종류'와 같은 모양) */
function Chip({ label, ...input }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="cursor-pointer">
      <input className="peer sr-only" {...input} />
      <span className="flex h-11 items-center rounded-badge bg-bg px-4 text-[15px] font-medium text-ink transition-colors peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">
        {label}
      </span>
    </label>
  );
}
