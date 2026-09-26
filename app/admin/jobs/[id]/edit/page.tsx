import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import JobForm from "@/components/admin-job-form";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import NotFoundCard from "@/components/not-found-card";
import { checkAdmin, getJobForEdit } from "@/lib/admin";

export const metadata: Metadata = { title: "공고 수정", robots: { index: false, follow: false } };

/** 관리자 · 공고 수정. 공고 관리 목록의 '수정'에서 들어온다. 저장하면 바로 사이트에 반영된다. */
export default async function AdminEditJobPage({ params }: PageProps<"/admin/jobs/[id]/edit">) {
  await connection();
  const { id } = await params;
  if (!(await checkAdmin(`/admin/jobs/${encodeURIComponent(id)}/edit`))) return <NotAdminCard />;

  const job = await getJobForEdit(id);

  return (
    <AdminShell active="jobs">
      {job ? (
        <>
          <Link href="/admin" className="text-sm font-semibold text-muted hover:text-ink">
            ← 공고 관리
          </Link>
          <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">공고 수정</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="nums">{job.id}</span>번 공고 · 저장하면 바로 사이트에 반영돼요.
            {job.hidden && <span className="font-semibold text-warn"> 지금은 숨긴 공고라 사이트에 보이지 않아요.</span>}
          </p>
          <div className="mt-5 max-w-[720px]">
            <JobForm job={job} />
          </div>
        </>
      ) : (
        <NotFoundCard
          title="공고를 찾을 수 없어요"
          description="주소가 틀렸거나 지워진 공고예요."
          primary={{ href: "/admin", label: "공고 관리로" }}
        />
      )}
    </AdminShell>
  );
}
