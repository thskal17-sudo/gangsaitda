import type { Metadata } from "next";
import { connection } from "next/server";
import AdminShell, { NotAdminCard } from "@/components/admin-shell";
import { DisconnectButton, SendTestButton } from "@/components/kakao-buttons";
import { checkAdmin } from "@/lib/admin";
import { formatKoreanDate, seoulDateOf } from "@/lib/date";
import { getKakaoStatus } from "@/lib/kakao";

export const metadata: Metadata = { title: "카톡 알림", robots: { index: false, follow: false } };

/** 주소 끝의 결과 표시(?connected=1, ?sent=1, ?failed=…) → 화면 안내 문구 */
const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "카카오 연결이 끝났어요. 아래 '시험 메시지 보내기'로 확인해 보세요." },
  sent: { tone: "ok", text: "시험 메시지를 보냈어요. 카톡 '나와의 채팅'을 확인해 보세요." },
  disconnected: { tone: "ok", text: "연결을 끊었어요. 알림을 다시 받으려면 '카카오 연결'을 눌러 주세요." },
  "failed=admin": { tone: "warn", text: "관리자만 할 수 있어요. 다시 로그인해 주세요." },
  "failed=key": { tone: "warn", text: "REST API 키(KAKAO_REST_API_KEY)가 Vercel 환경 변수에 없어요." },
  "failed=state": { tone: "warn", text: "연결 확인값이 맞지 않아요. '카카오 연결'을 다시 눌러 주세요." },
  "failed=denied": { tone: "warn", text: "카카오 화면에서 동의를 취소했어요. 다시 시도하면서 '카카오톡 메시지 전송'에 동의해 주세요." },
  "failed=connect": { tone: "warn", text: "카카오에서 열쇠를 받지 못했어요. 카카오 개발자 앱의 Redirect URI 와 REST API 키를 확인해 주세요." },
  "failed=send": { tone: "warn", text: "메시지를 보내지 못했어요. 아래 '마지막 오류'를 확인해 주세요." },
  "failed=disconnect": { tone: "warn", text: "연결을 끊지 못했어요. 잠시 뒤에 다시 시도해 주세요." },
};

/** 관리자 · 카톡 알림. 운영자 카카오 계정을 연결해 두면 강사섭외 의뢰가 올 때 카톡으로 알려 준다. */
export default async function AdminKakaoPage({ searchParams }: PageProps<"/admin/kakao">) {
  await connection();
  if (!(await checkAdmin("/admin/kakao"))) return <NotAdminCard />;

  const params = await searchParams;
  const noticeKey = params.connected ? "connected" : params.sent ? "sent" : params.disconnected ? "disconnected" : params.failed ? `failed=${params.failed}` : null;
  const notice = noticeKey ? NOTICES[noticeKey] : null;

  const status = await getKakaoStatus();
  const ready = status.keyConfigured && status.storageReady;

  const rows: { label: string; value: string; tone?: "ok" | "warn" }[] = [
    { label: "REST API 키", value: status.keyConfigured ? "설정됨" : "없음 — Vercel 환경 변수 KAKAO_REST_API_KEY", tone: status.keyConfigured ? "ok" : "warn" },
    {
      label: "연결 정보 보관",
      value: status.storageReady ? "준비됨" : "안 됨 — supabase/kakao-notify.sql 실행과 SUPABASE_SECRET_KEY 확인",
      tone: status.storageReady ? "ok" : "warn",
    },
    {
      label: "카카오 연결",
      value: status.connected
        ? `연결됨 (${status.connectedAt ? formatKoreanDate(seoulDateOf(status.connectedAt)) : ""} 연결)`
        : status.refreshExpiresAt
          ? "만료됨 — 다시 연결해 주세요"
          : "아직 연결 안 함",
      tone: status.connected ? "ok" : "warn",
    },
  ];
  if (status.connected && status.refreshExpiresAt) {
    rows.push({ label: "연결 유효 기간", value: `${formatKoreanDate(seoulDateOf(status.refreshExpiresAt))}까지 (그 전에 메시지를 보내면 자동으로 늘어나요)` });
  }

  return (
    <AdminShell active="kakao">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">카톡 알림</h1>
      <p className="mt-1 text-sm text-muted">강사섭외 의뢰가 들어오면 운영자 카톡 &lsquo;나와의 채팅&rsquo;으로 알려 줘요. 운영자 카카오 계정을 한 번만 연결하면 돼요.</p>

      {notice && (
        <p
          role="status"
          className={`mt-5 rounded-card px-5 py-4 text-[15px] ${notice.tone === "ok" ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}
        >
          {notice.text}
        </p>
      )}

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
            href="/api/kakao/connect"
            aria-disabled={!ready}
            className={`flex h-12 items-center rounded-control bg-[#FEE500] px-5 text-[15px] font-semibold text-[#191919] hover:bg-[#f5dc00] ${
              ready ? "" : "pointer-events-none opacity-50"
            }`}
          >
            {status.connected ? "다시 연결" : "카카오 연결"}
          </a>
          <SendTestButton disabled={!status.connected} />
          {status.connected && <DisconnectButton />}
        </div>
      </div>

      <div className="mt-5 rounded-card bg-white p-5 text-[14px] leading-relaxed text-muted md:p-6">
        <h2 className="text-[15px] font-bold text-ink">처음 연결하는 순서</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>카카오 개발자 앱 &lsquo;강사잇다&rsquo;: 카카오 로그인 활성화, Redirect URI 에 이 사이트 주소 + /api/kakao/callback, 동의항목 &lsquo;카카오톡 메시지 전송&rsquo;.</li>
          <li>Vercel 환경 변수에 REST API 키(KAKAO_REST_API_KEY)를 넣고 다시 배포.</li>
          <li>Supabase SQL Editor 에서 supabase/kakao-notify.sql 실행.</li>
          <li>위 &lsquo;카카오 연결&rsquo; → 카카오 로그인 → 동의 → 돌아오면 &lsquo;시험 메시지 보내기&rsquo;.</li>
        </ol>
        <p className="mt-2">연결은 두 달쯤 유지되고, 그 안에 메시지를 한 번이라도 보내면 자동으로 늘어나요. 끊기면 이 화면에 &lsquo;만료됨&rsquo;이 떠요.</p>
      </div>
    </AdminShell>
  );
}
