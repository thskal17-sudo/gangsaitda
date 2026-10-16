import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminInstructorForm from "@/components/admin-instructor-form";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "강사 직접 등록", robots: { index: false, follow: false } };

/** 관리자 · 강사 직접 등록. 사이트에 가입하지 않은 강사를, 동의를 받은 뒤 운영자가 올린다. */
export default async function AdminNewInstructorPage() {
  await connection();
  if (!(await checkAdmin("/admin/profiles/new"))) return <NotAdminCard />;

  return (
    <AdminShell active="profiles">
      <Link href="/admin/profiles" className="text-sm font-semibold text-muted hover:text-ink">
        ← 강사 프로필
      </Link>
      <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사 직접 등록</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        사이트에 가입하지 않은 강사님의 프로필을 올려요. 등록하면 의뢰의 &lsquo;추천 강사 관리&rsquo;에서 추천할 수 있어요.
        <br />
        <b className="text-ink">강사님께 기관 전달 동의를 먼저 받아 주세요.</b>
      </p>
      <div className="mt-5 max-w-[720px]">
        <AdminInstructorForm instructor={null} />
      </div>
    </AdminShell>
  );
}
