import Link from "next/link";

export default function JobNotFound() {
  return (
    <section className="rounded-card border border-line bg-white p-6 text-center md:p-10">
      <h1 className="text-lg font-bold text-ink">공고를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-muted">주소가 잘못되었거나 삭제된 공고입니다.</p>
      <Link
        href="/jobs"
        className="mt-5 inline-flex h-11 items-center rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
      >
        공고 목록 보기
      </Link>
    </section>
  );
}
