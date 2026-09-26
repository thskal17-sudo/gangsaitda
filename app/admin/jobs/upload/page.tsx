import type { Metadata } from "next";
import { connection } from "next/server";
import ExcelUpload from "@/components/admin-excel-upload";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin, getAllJobsForAdmin } from "@/lib/admin";
import { titleKey } from "@/lib/job-excel";

export const metadata: Metadata = { title: "엑셀로 올리기", robots: { index: false, follow: false } };

/** 관리자 · 엑셀 파일 하나로 공고 여러 개 올리기. 파일을 고르면 미리보기로 확인한 뒤 올린다. */
export default async function AdminExcelUploadPage() {
  await connection();
  if (!(await checkAdmin("/admin/jobs/upload"))) return <NotAdminCard />;

  // 이미 있는 제목은 미리보기에서 '건너뜀'으로 보여준다.
  const existingTitles = (await getAllJobsForAdmin()).map((job) => titleKey(job.title));

  return (
    <AdminShell active="upload">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">엑셀로 올리기</h1>
      <p className="mt-1 text-sm text-muted">
        양식에 공고를 한 줄에 하나씩 적어 올리면, 확인을 통과한 줄만 한꺼번에 사이트에 올라가요.
      </p>
      <div className="mt-5">
        <ExcelUpload existingTitles={existingTitles} />
      </div>
    </AdminShell>
  );
}
