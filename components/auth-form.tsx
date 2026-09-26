import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* 회원가입·로그인 화면이 함께 쓰는 조각들. */

/** 화면 틀: 제목, 설명, 흰 카드 안의 입력 폼, 아래쪽 안내 링크. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[420px] md:pt-4">
      <h1 className="text-[26px] font-bold tracking-tight text-ink md:text-[30px]">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-5 rounded-card bg-white p-5 md:p-7">{children}</div>
      <p className="mt-5 text-center text-sm text-muted">{footer}</p>
    </div>
  );
}

/** 이름표 + 입력칸 + 안내·오류 문구 한 벌. */
export function Field({
  id,
  label,
  hint,
  error,
  ...inputProps
}: { id: string; label: string; hint?: string; error?: string } & ComponentProps<"input">) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-2 block h-14 w-full rounded-control border-2 bg-bg px-4 text-[16px] text-ink transition-colors outline-none placeholder:text-muted/70 focus:border-brand focus:bg-white ${
          error ? "border-warn" : "border-transparent"
        }`}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-warn">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** 파란색 제출 버튼. 처리 중에는 눌리지 않게 한다. */
export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-14 w-full items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "잠시만 기다려 주세요…" : children}
    </button>
  );
}

/** 서버에서 돌아온 오류 (예: 이미 가입된 이메일). */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control bg-warn/8 px-4 py-3 text-sm font-medium text-warn">
      {message}
    </p>
  );
}

/** 가입 ↔ 로그인 화면을 오갈 때 돌아갈 주소(next)를 이어 붙인다. */
export function AuthSwitchLink({ href, next, children }: { href: string; next?: string; children: ReactNode }) {
  const query = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <Link href={`${href}${query}`} className="font-semibold text-brand underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
