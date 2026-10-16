import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminInstructorForm from "@/components/admin-instructor-form";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import NotFoundCard from "@/components/not-found-card";
import { checkAdmin } from "@/lib/admin";
import { getAdminInstructor } from "@/lib/admin-profiles";

export const metadata: Metadata = { title: "등록 강사 고치기", robots: { index: false, follow: false } };

/** 관리자 · 운영자가 등록한 강사 고치기·지우기 (강사가 직접 낸 프로필은 강사만 고칠 수 있다) */
export default async function AdminEditInstructorPage({ params }: PageProps<"/admin/profiles/[id]/edit">) {
  await connection();
  const { id } = await params;
  if (!(await checkAdmin(`/admin/profiles/${encodeURIComponent(id)}/edit`))) return <NotAdminCard />;

  const instructor = await getAdminInstructor(id);

  return (
    <AdminShell active="profiles">
      {instructor ? (
        <>
          <Link href="/admin/profiles" className="text-sm font-semibold text-muted hover:text-ink">
            ← 강사 프로필
          </Link>
          <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">등록 강사 고치기</h1>
          <p className="mt-1 text-sm text-muted">{instructor.name} 강사님 · 운영자가 직접 등록한 강사예요.</p>
          <div className="mt-5 max-w-[720px]">
            <AdminInstructorForm instructor={instructor} />
          </div>
        </>
      ) : (
        <NotFoundCard
          title="강사를 찾을 수 없어요"
          description="주소가 틀렸거나, 지워진 강사예요. 강사가 직접 낸 프로필은 강사만 고칠 수 있어요."
          primary={{ href: "/admin/profiles", label: "강사 프로필로" }}
        />
      )}
    </AdminShell>
  );
}
