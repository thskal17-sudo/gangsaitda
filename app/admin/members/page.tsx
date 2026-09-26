import type { Metadata } from "next";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { getAllMembers } from "@/lib/admin-members";
import { formatPhone } from "@/lib/admin-requests";
import { addDays, formatKoreanDate, todayInSeoul } from "@/lib/date";

export const metadata: Metadata = { title: "회원", robots: { index: false, follow: false } };

/** 관리자 · 회원 목록. 가입한 회원을 최근 순으로 본다 (보기만). */
export default async function AdminMembersPage({ searchParams }: PageProps<"/admin/members">) {
  await connection();
  if (!(await checkAdmin("/admin/members"))) return <NotAdminCard />;

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 50) : "";

  const today = todayInSeoul();
  const weekAgo = addDays(today, -6);
  const members = await getAllMembers();

  // 이름·이메일·연락처로 찾기. 연락처는 010-1234-5678 처럼 적어도 찾아진다.
  const qLower = q.toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const shown = q
    ? members.filter(
        (m) => m.name.toLowerCase().includes(qLower) || m.email.toLowerCase().includes(qLower) || (qDigits.length >= 3 && m.phone.includes(qDigits)),
      )
    : members;

  const stats = [
    { label: "전체 회원", value: members.length },
    { label: "오늘 가입", value: members.filter((m) => m.joinedDate === today).length },
    { label: "최근 7일 가입", value: members.filter((m) => m.joinedDate >= weekAgo).length },
  ];

  return (
    <AdminShell active="members">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">회원</h1>
      <p className="mt-1 text-sm text-muted">가입한 회원을 최근 순으로 보여줘요. 개인정보이니 필요한 때만 열어 주세요.</p>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-white p-4 md:p-5">
            <dt className="text-[13px] font-medium text-muted">{s.label}</dt>
            <dd className="nums mt-1 text-[26px] font-bold tracking-tight text-ink">
              {s.value}
              <span className="ml-0.5 text-[15px] font-semibold text-muted">명</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-card bg-white p-4 md:p-5">
        <form action="/admin/members" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="이름·이메일·연락처로 찾기"
            aria-label="회원 검색"
            className="h-12 min-w-0 flex-1 rounded-control bg-bg px-4 text-[15px] text-ink placeholder:text-muted focus:outline-2 focus:outline-brand"
          />
          <button type="submit" className="h-12 shrink-0 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand/90">
            찾기
          </button>
        </form>

        <p className="mt-4 text-sm text-muted">
          {q && <>&lsquo;{q}&rsquo; 검색 결과 · </>}
          <span className="nums font-semibold text-ink">{shown.length}</span>명
        </p>

        {shown.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">
            {q ? "찾는 회원이 없어요." : "아직 가입한 회원이 없어요."}
          </p>
        ) : (
          <>
            <div className="mt-3 hidden grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)_140px_64px] gap-4 border-b border-line pb-2 text-[13px] font-semibold text-muted md:grid">
              <span>가입일</span>
              <span>이름</span>
              <span>이메일</span>
              <span>연락처</span>
              <span>등급</span>
            </div>
            <ul className="divide-y divide-line">
              {shown.map((m) => (
                <li
                  key={m.id}
                  className="py-3.5 md:grid md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)_140px_64px] md:items-center md:gap-4"
                >
                  <span className="nums hidden text-[14px] text-muted md:block">{formatKoreanDate(m.joinedDate)}</span>
                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="truncate text-[16px] font-bold text-ink md:text-[15px] md:font-semibold">{m.name}</span>
                    <span className="nums shrink-0 text-[13px] text-muted md:hidden">{formatKoreanDate(m.joinedDate)} 가입</span>
                  </div>
                  <a href={`mailto:${m.email}`} className="block truncate text-[14px] text-ink hover:text-brand hover:underline">
                    {m.email}
                  </a>
                  <div className="flex items-center justify-between gap-3 md:contents">
                    <a href={`tel:${m.phone}`} className="nums text-[14px] text-ink hover:text-brand hover:underline">
                      {formatPhone(m.phone)}
                    </a>
                    <span className="w-fit rounded-badge bg-bg px-2.5 py-0.5 text-[12px] font-semibold text-muted">{m.grade}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AdminShell>
  );
}
