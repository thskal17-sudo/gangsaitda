import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { type AdminProfile, getAllProfiles } from "@/lib/admin-profiles";
import { formatPhone } from "@/lib/admin-requests";
import { formatKoreanDate } from "@/lib/date";
import { PROFILE_FIELDS, PROFILE_REGIONS } from "@/lib/profile-schema";

export const metadata: Metadata = { title: "강사 프로필", robots: { index: false, follow: false } };

/**
 * 관리자 · 강사 프로필. 기관 전달에 동의한 강사들. 의뢰가 오면 분야·지역으로 걸러 맞는 강사를 고르고,
 * 양식은 화면에서 읽고 파일은 내려받아 기관에 전달한다. 연락처는 섭외 확정 뒤에만 기관에 알린다.
 */
export default async function AdminProfilesPage({ searchParams }: PageProps<"/admin/profiles">) {
  await connection();
  if (!(await checkAdmin("/admin/profiles"))) return <NotAdminCard />;

  const params = await searchParams;
  const field = pick(params.field, PROFILE_FIELDS);
  const region = pick(params.region, PROFILE_REGIONS);

  const profiles = await getAllProfiles();
  // 지역으로 거를 때 '전국구' 강사는 어느 지역에나 함께 나온다.
  const shown = profiles.filter(
    (p) =>
      (!field || p.fields.includes(field)) &&
      (!region || p.regions.includes(region) || p.regions.includes("전국구")),
  );

  return (
    <AdminShell active="profiles">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사 프로필</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        기관 전달에 동의한 강사들이에요. 의뢰에 맞는 분야·지역으로 걸러 보세요.
        <br />
        <b className="text-ink">연락처는 섭외가 확정된 뒤에만</b> 기관에 알려 주세요.
      </p>

      <div className="mt-5 flex flex-col gap-3 rounded-card bg-white p-4 md:p-5">
        <FilterRow label="분야" name="field" values={PROFILE_FIELDS} current={field} other={{ region }} />
        <FilterRow label="지역" name="region" values={PROFILE_REGIONS} current={region} other={{ field }} />
      </div>

      <div className="mt-4 rounded-card bg-white p-4 md:p-5">
        <p className="text-sm text-muted">
          {(field || region) && <>{[field, region].filter(Boolean).join(" · ")} · </>}
          <span className="nums font-semibold text-ink">{shown.length}</span>명
          {region && region !== "전국구" && <span className="ml-1">(전국구 강사 포함)</span>}
        </p>

        {shown.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">
            {profiles.length === 0 ? "아직 프로필을 낸 강사가 없어요." : "조건에 맞는 강사가 없어요."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {shown.map((p) => (
              <ProfileRow key={p.memberId} profile={p} />
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function pick<T extends string>(value: unknown, list: readonly T[]): T | undefined {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** 거르기 단추 한 줄. 같은 단추를 다시 누르면 풀린다. */
function FilterRow({
  label,
  name,
  values,
  current,
  other,
}: {
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
    return `/admin/profiles${s ? `?${s}` : ""}`;
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

function ProfileRow({ profile: p }: { profile: AdminProfile }) {
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
