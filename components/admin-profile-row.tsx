import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminProfile } from "@/lib/admin-profiles";
import { formatPhone } from "@/lib/admin-requests";
import { formatKoreanDate } from "@/lib/date";

/*
 * 관리자 · 강사 프로필 줄과 거르기 단추. 강사 프로필 화면과 의뢰 상세 화면(추천 강사 고르기)이 함께 쓴다.
 */

/** 주소 값이 목록에 있으면 그 값, 아니면 undefined (거르기 단추용) */
export function pick<T extends string>(value: unknown, list: readonly T[]): T | undefined {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** 거르기 단추 한 줄. 같은 단추를 다시 누르면 풀린다. */
export function FilterRow({
  basePath,
  label,
  name,
  values,
  current,
  other,
}: {
  /** 단추를 누르면 갈 화면 (예: "/admin/profiles") */
  basePath: string;
  label: string;
  name: "field" | "region";
  values: readonly string[];
  current?: string;
  other: Record<string, string | undefined>;
}) {
  const href = (value?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(other)) if (v) q.set(k, v);
    if (value) q.set(name, value);
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const chip = "flex h-9 shrink-0 items-center rounded-badge px-3.5 text-[14px] font-medium transition-colors";

  return (
    <div className="flex items-start gap-3">
      <span className="w-9 shrink-0 pt-2 text-[13px] font-semibold text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <Link href={href()} className={`${chip} ${!current ? "bg-ink text-white" : "bg-bg text-ink hover:bg-line"}`}>
          전체
        </Link>
        {values.map((v) => (
          <Link
            key={v}
            href={href(current === v ? undefined : v)}
            aria-current={current === v ? "true" : undefined}
            className={`${chip} ${current === v ? "bg-brand font-semibold text-white" : "bg-bg text-ink hover:bg-line"}`}
          >
            {v}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProfileRow({
  profile: p,
  badge,
  children,
}: {
  profile: AdminProfile;
  /** 이름 옆에 붙일 표시 (예: 추천 강사의 진행 상태) */
  badge?: ReactNode;
  /** 줄 아래에 붙일 버튼들 (예: 추천하기, 상태 바꾸기) */
  children?: ReactNode;
}) {
  return (
    <li className="py-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-ink">{p.name}</span>
              <span className={`rounded-badge px-2 py-0.5 text-[11px] font-semibold ${p.method === "file" ? "bg-brand/10 text-brand" : "bg-ok/10 text-ok"}`}>
                {p.method === "file" ? "파일" : "양식"}
              </span>
              <span className="nums text-[12px] text-muted">{formatKoreanDate(p.updatedDate)} 저장</span>
              {badge}
            </div>
            <p className="text-[14px] text-ink">
              {p.fields.join(" · ")}
              <span className="mx-1.5 text-line">|</span>
              <span className="text-muted">{p.regions.join(" · ")}</span>
            </p>
          </div>
          <span className="text-sm font-semibold text-brand group-open:hidden">자세히 보기 ▾</span>
          <span className="hidden text-sm font-semibold text-muted group-open:inline">접기 ▴</span>
        </summary>

        <div className="mt-3 flex flex-col gap-3 rounded-control bg-bg p-4 text-[14px] leading-relaxed text-ink">
          {p.method === "file" ? (
            p.hasFile ? (
              <a
                href={`/admin/profiles/${p.memberId}/file`}
                className="flex h-11 w-fit items-center rounded-control bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand/90"
              >
                파일 내려받기 · <span className="ml-1 max-w-[220px] truncate">{p.fileName}</span>
              </a>
            ) : (
              <p className="text-muted">올린 파일을 찾을 수 없어요.</p>
            )
          ) : (
            <>
              <Block title="강의 경력" text={p.career} />
              {p.certificates && <Block title="자격·학력" text={p.certificates} />}
              {p.intro && <Block title="자기소개" text={p.intro} />}
            </>
          )}
          <p className="border-t border-line pt-3 text-[13px] text-muted">
            운영자 확인용 연락처 (기관에는 섭외 확정 뒤에만):{" "}
            <a href={`tel:${p.phone}`} className="nums text-ink hover:underline">
              {formatPhone(p.phone)}
            </a>
            {" · "}
            <a href={`mailto:${p.email}`} className="text-ink hover:underline">
              {p.email}
            </a>
          </p>
        </div>
      </details>
      {children && <div className="mt-3">{children}</div>}
    </li>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-muted">{title}</p>
      <p className="mt-0.5 whitespace-pre-line">{text}</p>
    </div>
  );
}
