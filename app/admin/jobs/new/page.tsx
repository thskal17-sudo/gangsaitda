import type { Metadata } from "next";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import JobForm from "./job-form";

export const metadata: Metadata = { title: "공고 등록", robots: { index: false, follow: false } };

/** 관리자 · 공고 등록. 저장하면 바로 사이트에 올라간다. */
export default async function AdminNewJobPage() {
  await connection();
  if (!(await checkAdmin("/admin/jobs/new"))) return <NotAdminCard />;

  return (
    <AdminShell active="new">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">공고 등록</h1>
      <p className="mt-1 text-sm text-muted">저장하면 바로 사이트에 올라가요. 제목은 비회원도 볼 수 있어요.</p>
      <div className="mt-5 max-w-[720px]">
        <JobForm />
      </div>
    </AdminShell>
  );
}
