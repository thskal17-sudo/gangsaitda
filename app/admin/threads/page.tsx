import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { AppKeysForm, CheckButton, DisconnectButton, DraftCard, DraftKeyForm, RetryFailedButton } from "@/components/threads-buttons";
import { checkAdmin } from "@/lib/admin";
import { formatKoreanDate, seoulDateOf } from "@/lib/date";
import { countFailedThreadsPosts, getRecentThreadsPosts, getDraftKeyStatus, getThreadsDrafts, getThreadsStatus, type ThreadsDraft } from "@/lib/threads";

export const metadata: Metadata = { title: "Threads 게시", robots: { index: false, follow: false } };

/** 주소 끝의 결과 표시(?connected=1, ?checked=1, ?failed=…) → 화면 안내 문구 */
const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "Threads 연결이 끝났어요. 이제 새 공고가 올라가면 Threads 에도 자동으로 올라가요." },
  checked: { tone: "ok", text: "연결이 잘 되어 있어요. (확인만 했고 글은 올리지 않았어요)" },
  keys: { tone: "ok", text: "Threads 앱 ID·시크릿을 저장했어요. 이제 아래 'Threads 연결'을 눌러 주세요." },
  "failed=appid": { tone: "warn", text: "Threads 앱 ID는 숫자만 넣어 주세요. Meta 화면의 'Threads 앱 ID'(앱 ID 아님)를 그대로 복사해 주세요." },
  "failed=secret": { tone: "warn", text: "Threads 앱 시크릿 코드가 올바르지 않아요. Meta 화면에서 '보기'를 눌러 나온 값을 앞뒤 빈칸 없이 넣어 주세요." },
  "failed=savekeys": { tone: "warn", text: "저장하지 못했어요. supabase/threads-post.sql 을 실행했는지 확인해 주세요." },
  disconnected: { tone: "ok", text: "연결을 끊었어요. 새 공고가 Threads 에 올라가지 않아요. 다시 쓰려면 'Threads 연결'을 눌러 주세요." },
  "failed=admin": { tone: "warn", text: "관리자만 할 수 있어요. 다시 로그인해 주세요." },
  "failed=key": { tone: "warn", text: "Threads 앱 ID·시크릿이 아직 없어요. 아래 'Threads 앱 열쇠'에 먼저 저장해 주세요." },
  "failed=state": { tone: "warn", text: "연결 확인값이 맞지 않아요. 'Threads 연결'을 다시 눌러 주세요." },
  "failed=denied": { tone: "warn", text: "Threads 화면에서 허용을 취소했어요. 다시 시도하면서 '허용'을 눌러 주세요." },
  "failed=connect": {
    tone: "warn",
    text: "Threads 에서 열쇠를 받지 못했어요. 앱 시크릿 값, 리디렉션 콜백 URL, 운영자 계정이 'Threads 테스터'로 수락됐는지 확인해 주세요.",
  },
  "failed=retry": { tone: "warn", text: "다시 올리지 못했어요. 아래 '마지막 오류'를 확인해 주세요." },
  "failed=check": { tone: "warn", text: "연결 확인에 실패했어요. 아래 '마지막 오류'를 확인해 주세요." },
  "failed=disconnect": { tone: "warn", text: "연결을 끊지 못했어요. 잠시 뒤에 다시 시도해 주세요." },
  draftPosted: { tone: "ok", text: "Threads 에 올렸어요. Threads 앱에서 확인해 보세요." },
  draftDiscarded: { tone: "ok", text: "글을 버렸어요. Threads 에는 올리지 않았어요." },
  "failed=draft": { tone: "warn", text: "글을 처리하지 못했어요. 화면을 새로 고친 뒤 다시 눌러 주세요." },
  "failed=draftlength": { tone: "warn", text: "글이 비어 있거나 500자를 넘어요. 고친 뒤 다시 올려 주세요." },
  "failed=draftpost": { tone: "warn", text: "Threads 에 올리지 못했어요. 글은 그대로 남아 있으니 다시 눌러 보세요." },
};

/** 올릴 글 카드 위의 날짜 (어느 날 글인지. 날짜가 없으면 들어온 날) */
function draftDate(d: ThreadsDraft) {
  return formatKoreanDate(d.forDate ?? seoulDateOf(d.createdAt));
}

/** 관리자 · Threads 자동 게시. 운영자 Threads 계정을 연결해 두면 새 공고의 제목과 링크를 자동으로 올린다. */
export default async function AdminThreadsPage({ searchParams }: PageProps<"/admin/threads">) {
  await connection();
  if (!(await checkAdmin("/admin/threads"))) return <NotAdminCard />;

  const params = await searchParams;
  const noticeKey = params.connected
    ? "connected"
    : params.checked
      ? "checked"
      : params.keys
        ? "keys"
        : params.disconnected
        ? "disconnected"
        : params.draftPosted
        ? "draftPosted"
        : params.draftDiscarded
        ? "draftDiscarded"
        : params.failed
          ? `failed=${params.failed}`
          : null;
  // 다시 올리기 결과 (?retried=올린 수&of=실패였던 수)
  const retried = typeof params.retried === "string" ? Number(params.retried) : null;
  const retriedOf = typeof params.of === "string" ? Number(params.of) : 0;
  const notice =
    retried !== null && Number.isFinite(retried)
      ? retried > 0
        ? { tone: "ok" as const, text: `실패했던 공고 ${retried}건을 Threads 에 글 하나로 다시 올렸어요.` }
        : { tone: "ok" as const, text: `다시 올릴 공고가 없었어요 (실패 ${retriedOf}건이 숨김·마감이라 기록만 지웠어요).` }
      : noticeKey
        ? NOTICES[noticeKey]
        : null;
  // 연결 실패 이유 (callback 이 붙여 보냄). 글자만 보여주고 링크·코드로 해석하지 않는다.
  const why = typeof params.why === "string" ? params.why.slice(0, 160) : "";

  const [status, posts, drafts, draftKey] = await Promise.all([getThreadsStatus(), getRecentThreadsPosts(), getThreadsDrafts(), getDraftKeyStatus()]);
  const ready = status.keysConfigured && status.storageReady;
  const failedCount = await countFailedThreadsPosts();

  const rows: { label: string; value: string; tone?: "ok" | "warn" }[] = [
    {
      label: "앱 ID·시크릿",
      value: status.keysConfigured
        ? `설정됨 (앱 ID ${status.appId}${status.keysSource === "env" ? " · 사이트 환경 변수" : ""})`
        : "없음 — 아래 'Threads 앱 열쇠'에 넣어 주세요",
      tone: status.keysConfigured ? "ok" : "warn",
    },
    {
      label: "연결 정보 보관",
      value: status.storageReady ? "준비됨" : "안 됨 — supabase/threads-post.sql 실행과 SUPABASE_SECRET_KEY 확인",
      tone: status.storageReady ? "ok" : "warn",
    },
    {
      label: "Threads 연결",
      value: status.connected
        ? `연결됨${status.username ? ` (@${status.username})` : ""} · ${status.connectedAt ? formatKoreanDate(seoulDateOf(status.connectedAt)) : ""} 연결`
        : status.expiresAt
          ? "만료됨 — 다시 연결해 주세요"
          : "아직 연결 안 함",
      tone: status.connected ? "ok" : "warn",
    },
  ];
  if (status.connected && status.expiresAt) {
    rows.push({ label: "연결 유효 기간", value: `${formatKoreanDate(seoulDateOf(status.expiresAt))}까지 (그 전에 새 공고가 올라가면 자동으로 늘어나요)` });
  }

  return (
    <AdminShell active="threads">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">Threads 게시</h1>
      <p className="mt-1 text-sm text-muted">
        새 공고가 사이트에 올라가면 운영자 Threads 계정에 &lsquo;[강사잇다 새 공고] 제목 + 링크&rsquo;를 자동으로 올려요. 기관·지역·마감일은 넣지 않아요.
      </p>

      {notice && (
        <p
          role="status"
          className={`mt-5 rounded-card px-5 py-4 text-[15px] ${notice.tone === "ok" ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}
        >
          {notice.text}
          {why && <span className="mt-1 block text-[13px] opacity-80">이유: {why}</span>}
        </p>
      )}

      <div className="mt-5 rounded-card bg-white p-5 md:p-6">
        <h2 className="text-[17px] font-bold">올릴 글</h2>
        <p className="mt-1 text-[14px] text-muted">
          홍보 담당이 쓴 글이 여기에 쌓여요. 읽고 고친 뒤 [올리기]를 눌러야 Threads 에 올라가요. 누르기 전에는 아무것도 올라가지 않아요.
        </p>
        {!drafts.ready ? (
          <p className="mt-3 text-[14px] text-warn">먼저 Supabase SQL Editor 에서 supabase/threads-drafts.sql 을 실행해 주세요.</p>
        ) : drafts.waiting.length === 0 ? (
          <p className="mt-3 rounded-control bg-bg px-4 py-3 text-[15px] text-muted">올릴 글이 없어요.</p>
        ) : (
          <ul className="divide-y divide-line">
            {drafts.waiting.map((d) => (
              <li key={d.id} className="py-4">
                <p className="text-[14px] font-semibold">
                  {draftDate(d)} · <span className={d.status === "올리는 중" ? "text-warn" : "text-accent"}>{d.status}</span>
                </p>
                {d.status === "올리는 중" && (
                  <p className="mt-1 text-[13px] text-warn">올리다 멈춘 글이에요. Threads 앱에서 올라갔는지 확인한 뒤, 올라갔으면 [버리기]로 치워 주세요.</p>
                )}
                {d.error && d.status === "대기" && <p className="mt-1 text-[13px] text-warn">지난번 실패 이유: {d.error}</p>}
                <DraftCard id={d.id} initialBody={d.body} canPost={status.connected} posting={d.status === "올리는 중"} />
              </li>
            ))}
          </ul>
        )}
        {drafts.ready && !status.connected && drafts.waiting.length > 0 && (
          <p className="mt-2 text-[13px] text-warn">Threads 가 연결돼 있지 않아 [올리기]를 누를 수 없어요. 아래 &lsquo;연결 상태&rsquo;에서 먼저 연결해 주세요.</p>
        )}
        {drafts.done.length > 0 && (
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {drafts.done.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3 text-[14px]">
                <span className="shrink-0 tabular-nums text-muted">{draftDate(d)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{d.body.split("\n")[0]}</span>
                <span className={`shrink-0 font-semibold ${d.status === "올림" ? "text-ok" : "text-muted"}`}>{d.status === "올림" ? "올림 ✓" : "버림"}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-[15px] font-bold">받는 문 열쇠</h3>
          <p className="mt-1 text-[13px] text-muted">
            홍보 담당이 이 상자로 글을 보낼 때 쓰는 비밀 열쇠예요.{" "}
            {draftKey.source === "env"
              ? "사이트 환경 변수(THREADS_DRAFT_TOKEN)에 넣어 둔 열쇠를 쓰고 있어요."
              : draftKey.source === "admin" && draftKey.createdAt
                ? `${formatKoreanDate(seoulDateOf(draftKey.createdAt))}에 만들었어요.`
                : "아직 없어요. 만들어야 글이 들어와요."}
          </p>
          {draftKey.source !== "env" &&
            (draftKey.ready ? (
              <DraftKeyForm hasKey={draftKey.source === "admin"} />
            ) : (
              <p className="mt-2 text-[13px] text-warn">먼저 Supabase SQL Editor 에서 supabase/threads-drafts.sql 을 실행해 주세요.</p>
            ))}
        </div>
      </div>

      <div className="mt-5 rounded-card bg-white p-5 md:p-6">
        <h2 className="text-[17px] font-bold">연결 상태</h2>
        <dl className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:gap-6">
              <dt className="w-32 shrink-0 text-[14px] font-medium text-muted">{r.label}</dt>
              <dd className={`text-[15px] ${r.tone === "ok" ? "text-ok" : r.tone === "warn" ? "text-warn" : "text-ink"}`}>{r.value}</dd>
            </div>
          ))}
        </dl>
        {status.lastError && (
          <p className="mt-3 rounded-control bg-bg px-4 py-3 text-[13px] text-muted">
            마지막 오류: <span className="text-warn">{status.lastError}</span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="/api/threads/connect"
            aria-disabled={!ready}
            className={`flex h-12 items-center rounded-control bg-ink px-5 text-[15px] font-semibold text-white hover:bg-ink/90 ${
              ready ? "" : "pointer-events-none opacity-50"
            }`}
          >
            {status.connected ? "다시 연결" : "Threads 연결"}
          </a>
          <CheckButton disabled={!status.connected} />
          {status.connected && <DisconnectButton />}
          {failedCount > 0 && <RetryFailedButton count={failedCount} disabled={!status.connected} />}
        </div>
      </div>

      {status.keysSource !== "env" && (
        <div className="mt-5 rounded-card bg-white p-5 md:p-6">
          <h2 className="text-[17px] font-bold">Threads 앱 열쇠</h2>
          <p className="mt-1 text-[14px] text-muted">
            Meta 개발자 화면 → 이용 사례 &lsquo;Threads API 액세스&rsquo; → 설정에 있는 값이에요. 앱 설정의 &lsquo;앱 ID&rsquo;와는 달라요. 시크릿은 저장 뒤 다시 보여주지 않아요.
          </p>
          {status.storageReady ? (
            <AppKeysForm savedAppId={status.keysSource === "admin" ? status.appId : null} />
          ) : (
            <p className="mt-3 text-[14px] text-warn">먼저 Supabase SQL Editor 에서 supabase/threads-post.sql 을 실행해 주세요.</p>
          )}
        </div>
      )}

      <div className="mt-5 rounded-card bg-white p-5 md:p-6">
        <h2 className="text-[17px] font-bold">최근에 올린 공고</h2>
        {posts.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">아직 올린 공고가 없어요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {posts.map((p) => (
              <li key={p.jobId} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:gap-4">
                <span className="w-24 shrink-0 text-[13px] tabular-nums text-muted">{formatKoreanDate(seoulDateOf(p.postedAt ?? p.createdAt))}</span>
                <Link href={`/jobs/${p.jobId}`} className="min-w-0 flex-1 truncate text-[15px] hover:underline">
                  {p.title}
                </Link>
                <span className={`shrink-0 text-[13px] font-semibold ${p.status === "올림" ? "text-ok" : p.status === "실패" ? "text-warn" : "text-muted"}`}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 rounded-card bg-white p-5 text-[14px] leading-relaxed text-muted md:p-6">
        <h2 className="text-[15px] font-bold text-ink">처음 연결하는 순서</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Meta 개발자 사이트에서 앱 만들기 → 사용 사례 &lsquo;Threads API 액세스&rsquo; → 권한 threads_basic, threads_content_publish 추가.</li>
          <li>Threads 설정의 리디렉션 콜백 URL 에 이 사이트 주소 + /api/threads/callback 입력.</li>
          <li>앱 역할에서 운영자 Threads 계정을 &lsquo;Threads 테스터&rsquo;로 추가 → Threads 앱(설정 → 계정 → 웹사이트 권한 → 초대)에서 수락.</li>
          <li>Supabase SQL Editor 에서 supabase/threads-post.sql 실행.</li>
          <li>위 &lsquo;Threads 앱 열쇠&rsquo;에 Threads 앱 ID·시크릿을 넣고 저장.</li>
          <li>위 &lsquo;Threads 연결&rsquo; → Threads 로그인 → 허용 → 돌아오면 &lsquo;연결 확인&rsquo;.</li>
        </ol>
        <p className="mt-2">
          연결한 뒤에 올라온 공고만 올려요. 한 번에 여러 건(엑셀·수집)이 올라오면 제목 몇 개를 묶어 글 하나로 올려요. 같은 공고는 두 번 올리지 않고, 숨긴 공고·마감 지난 공고는 올리지 않아요.
        </p>
      </div>
    </AdminShell>
  );
}
