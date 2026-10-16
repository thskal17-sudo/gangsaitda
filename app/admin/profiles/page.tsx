import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { FilterRow, ProfileRow, pick } from "@/components/admin-profile-row";
import { getAllProfiles } from "@/lib/admin-profiles";
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사 프로필</h1>
        <Link
          href="/admin/profiles/new"
          className="flex h-11 shrink-0 items-center rounded-control bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand/90"
        >
          + 강사 직접 등록
        </Link>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        기관 전달에 동의한 강사들이에요. 의뢰에 맞는 분야·지역으로 걸러 보세요.
        <br />
        <b className="text-ink">연락처는 섭외가 확정된 뒤에만</b> 기관에 알려 주세요.
        <br />
        사이트에 가입하지 않은 강사님은 동의를 받은 뒤 &lsquo;강사 직접 등록&rsquo;으로 올릴 수 있어요.
      </p>

      {(params.saved || params.deleted) && (
        <p role="status" className="mt-4 rounded-card bg-ok/10 px-5 py-4 text-[15px] font-semibold text-ok">
          {params.deleted ? "등록한 강사를 지웠어요." : "강사를 저장했어요. 의뢰의 '추천 강사 관리'에서 추천할 수 있어요."}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 rounded-card bg-white p-4 md:p-5">
        <FilterRow basePath="/admin/profiles" label="분야" name="field" values={PROFILE_FIELDS} current={field} other={{ region }} />
        <FilterRow basePath="/admin/profiles" label="지역" name="region" values={PROFILE_REGIONS} current={region} other={{ field }} />
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
