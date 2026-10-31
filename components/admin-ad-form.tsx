"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormError, SubmitButton } from "@/components/auth-form";
import { clearAd, prepareAdImageUpload, saveAd } from "@/lib/admin-ad-actions";
import { AD_IMAGE_MAX_BYTES, AD_IMAGE_TYPES, adImageExtension, type HomeAdFormValues, homeAdSchema } from "@/lib/home-ad-schema";
import type { HomeAd } from "@/lib/home-ads";

/**
 * 관리자 · 광고 칸 하나의 양식. 저장하면 홈 화면 카드가 바로 바뀐다.
 * imageUrl: 지금 사진을 띄울 주소 (없으면 사진 없음)
 */
export default function AdminAdForm({ ad, imageUrl }: { ad: HomeAd; imageUrl?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [removeImage, setRemoveImage] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<string>();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HomeAdFormValues>({
    resolver: zodResolver(homeAdSchema),
    defaultValues: {
      name: ad.name,
      provider: ad.provider,
      href: ad.href,
      until: ad.until,
      endedText: ad.endedText,
    },
  });

  const id = (name: string) => `ad${ad.slot}-${name}`;

  const onPickFile = (picked: File | undefined) => {
    setFileError(undefined);
    setFile(null);
    setPreview(undefined);
    if (!picked) return;
    if (!adImageExtension(picked.type)) return setFileError("jpg·png·webp·gif 사진만 올릴 수 있어요.");
    if (picked.size > AD_IMAGE_MAX_BYTES) return setFileError("사진은 5MB 까지 올릴 수 있어요.");
    setFile(picked);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(picked));
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    setNotice(undefined);

    let image: string | undefined = removeImage ? "remove" : undefined;
    if (file) {
      // 1) 올릴 자리 받기 → 2) 브라우저가 저장소에 바로 올리기
      const ticket = await prepareAdImageUpload(ad.slot, file.type, file.size);
      if ("error" in ticket) return setServerError(ticket.error);
      const res = await fetch(ticket.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      }).catch(() => null);
      if (!res?.ok) return setServerError("사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      image = ticket.path;
    }

    // 3) 저장
    const result = await saveAd(ad.slot, values, image);
    if ("error" in result) return setServerError(result.error);
    setFile(null);
    setRemoveImage(false);
    setNotice("저장했어요. 홈 화면에 바로 보여요.");
    router.refresh();
  });

  const onClear = async () => {
    if (!window.confirm(`${ad.slot}번 칸을 비울까요? 홈 화면에는 '교육 광고 모집합니다'로 보이고, 올린 사진도 지워져요.`)) return;
    setServerError(undefined);
    setNotice(undefined);
    setClearing(true);
    const result = await clearAd(ad.slot);
    setClearing(false);
    if ("error" in result) return setServerError(result.error);
    reset({ name: "", provider: "", href: "", until: "", endedText: "" });
    setFile(null);
    setPreview(undefined);
    setNotice("비웠어요. 홈 화면에 '교육 광고 모집합니다'로 보여요.");
    router.refresh();
  };

  const shownImage = preview ?? (removeImage ? undefined : imageUrl);

  return (
    // PC 에서는 왼쪽 사진, 오른쪽 입력 칸
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 md:grid md:grid-cols-[260px_minmax(0,1fr)] md:items-start md:gap-6">
      <div>
        <p className="text-sm font-semibold text-ink">사진</p>
        <div className="mt-2 flex h-[140px] items-center justify-center overflow-hidden rounded-[14px] border border-black/[0.06] bg-bg">
          {shownImage ? (
            // 미리보기라 그대로 띄운다 (방금 고른 사진은 아직 저장소에 없으므로)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownImage} alt={`${ad.slot}번 칸 사진`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted">사진 없음 (색깔 상자로 보여요)</span>
          )}
        </div>
        <input
          id={id("image")}
          type="file"
          accept={AD_IMAGE_TYPES.join(",")}
          aria-label={`${ad.slot}번 칸 사진 고르기`}
          onChange={(e) => onPickFile(e.target.files?.[0])}
          className="mt-2 block w-full rounded-control bg-bg p-3 text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-1.5 text-xs text-muted">jpg·png·webp·gif, 5MB 까지. 가로로 긴 사진(약 3:2)이 잘 맞아요.</p>
        {fileError && <p className="mt-1.5 text-sm text-warn">{fileError}</p>}
        {imageUrl && !file && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={removeImage}
              onChange={(e) => setRemoveImage(e.target.checked)}
            />
            사진 빼기 (저장하면 색깔 상자로 보여요)
          </label>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Field
          id={id("name")}
          label="과정 이름"
          autoComplete="off"
          placeholder="예) 방과후 코딩 강사 양성과정"
          error={errors.name?.message}
          {...register("name")}
        />
        <Field
          id={id("provider")}
          label="카드 아래 한 줄 (선택)"
          autoComplete="off"
          placeholder="예) 11월 10일 개강 · ○○교육원"
          error={errors.provider?.message}
          {...register("provider")}
        />
        <Field
          id={id("href")}
          label="누르면 갈 주소"
          autoComplete="off"
          inputMode="url"
          placeholder="https://… (신청폼·기관 소개 주소)"
          hint="다른 사이트 주소는 새 창으로 열려요. 강사잇다 교육 소개 화면이면 /courses/… 처럼 적어요."
          error={errors.href?.message}
          {...register("href")}
        />
        <Field
          id={id("until")}
          label="신청 마감일 (선택)"
          type="date"
          hint="이 날까지 신청을 받아요. 다음 날부터 카드에 '지난 교육'이 붙고 사진이 흐려져요. 비우면 계속 신청 중으로 보여요."
          error={errors.until?.message}
          {...register("until")}
        />
        <Field
          id={id("endedText")}
          label="마감 뒤 카드 아래 한 줄 (선택)"
          autoComplete="off"
          placeholder="예) 11월 10일 진행 · 지난 교육"
          hint="비우면 '지난 교육'이라고만 보여요."
          error={errors.endedText?.message}
          {...register("endedText")}
        />

        <FormError message={serverError} />
        {notice && (
          <p role="status" className="rounded-control bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
            {notice}
          </p>
        )}
        <SubmitButton pending={isSubmitting}>{ad.slot}번 칸 저장</SubmitButton>
        {ad.name && (
          <button
            type="button"
            onClick={onClear}
            disabled={clearing || isSubmitting}
            className="h-12 text-sm font-semibold text-muted underline-offset-2 hover:text-warn hover:underline disabled:opacity-60"
          >
            {clearing ? "비우는 중…" : "이 칸 비우기 (광고 모집 자리로)"}
          </button>
        )}
      </div>
    </form>
  );
}
