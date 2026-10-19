import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import MemberTypeButton from "@/components/admin-member-type-button";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { checkAdmin } from "@/lib/admin";
import { filterMembers, getAllMembers, parseMemberFilter } from "@/lib/admin-members";
import { formatPhone } from "@/lib/admin-requests";
import { addDays, formatKoreanDate, todayInSeoul } from "@/lib/date";

export const metadata: Metadata = { title: "회원", robots: { index: false, follow: false } };

/**
 * 관리자 · 회원 목록. 가입한 회원을 최근 순으로 본다.
 * 회원 종류(강사 / 기관)를 보여 주고, 가입할 때 잘못 고른 회원은 여기서 바꾼다.
 * '문자 수신 동의만'(?sms=1)을 누르면 교육·강의 섭외 소식 문자를 받겠다고 한 회원만 보인다. 문자는 이 회원들에게만 보낸다.
 */
export default async function AdminMembersPage({ searchParams }: PageProps<"/admin/members">) {
  await connection();
  if (!(await checkAdmin("/admin/members"))) return <NotAdminCard />;

  const params = await searchParams;
  const filter = parseMemberFilter(params);
  const { q, smsOnly } = filter;
  const failed = params.failed === "type";

  const today = todayInSeoul();
  const weekAgo = addDays(today, -6);
  const members = await getAllMembers();

  // 이름·기관명·이메일·연락처로 찾기 + 문자 수신 동의만 (엑셀 내려받기도 같은 조건)
  const shown = filterMembers(members, filter);
  const smsCount = members.filter((m) => m.smsDate).length;
  // 걸러 보기 단추가 검색어를 이어 가게
  const query = (sms: boolean) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sms) sp.set("sms", "1");
    const s = sp.toString();
    return s ? `?${s}` : "";
  };
  const filterHref = (sms: boolean) => `/admin/members${query(sms)}`;

  const stats = [
    {
      label: "전체 회원",
      value: members.length,
      note: `강사 ${members.filter((m) => m.type === "강사").length} · 기관 ${members.filter((m) => m.type === "기관").length} · 문자 동의 ${smsCount}`,
    },
    { label: "오늘 가입", value: members.filter((m) => m.joinedDate === today).length },
    { label: "최근 7일 가입", value: members.filter((m) => m.joinedDate >= weekAgo).length },
  ];

  return (
    <AdminShell active="members">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">회원</h1>
      <p className="mt-1 text-sm text-muted">가입한 회원을 최근 순으로 보여줘요. 개인정보이니 필요한 때만 열어 주세요.</p>

      {failed && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] font-semibold text-warn">
          회원 종류를 바꾸지 못했어요. 잠시 뒤에 다시 시도해 주세요.
        </p>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-white p-4 md:p-5">
            <dt className="text-[13px] font-medium text-muted">{s.label}</dt>
            <dd className="nums mt-1 text-[26px] font-bold tracking-tight text-ink">
              {s.value}
              <span className="ml-0.5 text-[15px] font-semibold text-muted">명</span>
              {"note" in s && <span className="mt-0.5 block text-[12px] font-medium tracking-normal text-muted">{s.note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-card bg-white p-4 md:p-5">
        <form action="/admin/members" className="flex gap-2">
          {smsOnly && <input type="hidden" name="sms" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="이름·기관명·이메일·연락처로 찾기"
            aria-label="회원 검색"
            className="h-12 min-w-0 flex-1 rounded-control bg-bg px-4 text-[15px] text-ink placeholder:text-muted focus:outline-2 focus:outline-brand"
          />
          <button type="submit" className="h-12 shrink-0 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand/90">
            찾기
          </button>
        </form>

        <div className="mt-3 flex gap-2">
          {[
            { label: "전체", on: !smsOnly, href: filterHref(false) },
            { label: `문자 수신 동의만 (${smsCount})`, on: smsOnly, href: filterHref(true) },
          ].map((f) => (
            <Link
              key={f.label}
              href={f.href}
              aria-current={f.on ? "true" : undefined}
              className={`nums flex h-9 items-center rounded-badge px-3.5 text-[14px] font-semibold transition-colors ${
                f.on ? "bg-ink text-white" : "bg-bg text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {q && <>&lsquo;{q}&rsquo; 검색 결과 · </>}
            <span className="nums font-semibold text-ink">{shown.length}</span>명
          </p>
          {/* 지금 보이는 회원 그대로 엑셀(CSV)로. 개인정보이니 필요한 때만 받고, 다 쓴 파일은 지워 주세요. */}
          {shown.length > 0 && (
            <a
              href={`/admin/members/export${query(smsOnly)}`}
              download
              className="flex h-9 shrink-0 items-center rounded-control bg-ok/10 px-3.5 text-[14px] font-semibold text-ok transition-colors hover:bg-ok/15"
            >
              엑셀로 내려받기
            </a>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg p-5 text-center text-sm text-muted">
            {q || smsOnly ? "찾는 회원이 없어요." : "아직 가입한 회원이 없어요."}
          </p>
        ) : (
          <>
            <div className="mt-3 hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1.3fr)_130px_150px_56px] gap-4 border-b border-line pb-2 text-[13px] font-semibold text-muted md:grid">
              <span>가입일</span>
              <span>이름</span>
              <span>이메일</span>
              <span>연락처</span>
              <span>종류</span>
              <span>등급</span>
            </div>
            <ul className="divide-y divide-line">
              {shown.map((m) => (
                <li
                  key={m.id}
                  className="py-3.5 md:grid md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.3fr)_130px_150px_56px] md:items-center md:gap-4"
                >
                  <span className="nums hidden text-[14px] text-muted md:block">{formatKoreanDate(m.joinedDate)}</span>
                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-bold text-ink md:text-[15px] md:font-semibold">{m.name}</span>
                      {m.orgName && <span className="block truncate text-[13px] text-muted">{m.orgName}</span>}
                    </span>
                    <span className="nums shrink-0 text-[13px] text-muted md:hidden">{formatKoreanDate(m.joinedDate)} 가입</span>
                  </div>
                  <a href={`mailto:${m.email}`} className="block truncate text-[14px] text-ink hover:text-brand hover:underline">
                    {m.email}
                  </a>
                  <div className="mt-1 flex items-center gap-2 md:contents">
                    <span className="flex flex-col">
                      <a href={`tel:${m.phone}`} className="nums text-[14px] text-ink hover:text-brand hover:underline">
                        {formatPhone(m.phone)}
                      </a>
                      {m.smsDate && <span className="nums text-[12px] font-semibold text-ok">문자 동의 · {formatKoreanDate(m.smsDate)}</span>}
                    </span>
                    <div className="ml-auto flex items-center gap-2 md:ml-0">
                      <span
                        className={`rounded-badge px-2.5 py-0.5 text-[12px] font-semibold ${
                          m.type === "기관" ? "bg-accent/10 text-accent" : "bg-brand/10 text-brand"
                        }`}
                      >
                        {m.type}
                      </span>
                      <MemberTypeButton id={m.id} name={m.name} type={m.type} />
                    </div>
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
