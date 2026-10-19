import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SMS_TERMS } from "@/components/privacy-consent";
import { formatKoreanDate, seoulDateOf } from "@/lib/date";
import { getCurrentMember } from "@/lib/member";
import { getMySmsConsent } from "@/lib/sms-consent";
import SmsButton from "./sms-button";

export const metadata: Metadata = { title: "문자 수신 설정", robots: { index: false, follow: false } };

/**
 * 문자 수신 설정. 회원만. 교육·강의 섭외 소식 문자(광고성 정보)를 받을지 회원이 직접 켜고 끈다.
 * 바꾸면 처리 결과(날짜·내용)를 바로 보여준다 (정보통신망법의 처리 결과 알림).
 */
export default async function SmsSettingsPage({ searchParams }: PageProps<"/account/sms">) {
  await connection();
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/account/sms");

  const sp = await searchParams;
  const consent = await getMySmsConsent(member.id);
  const done = sp.done === "on" || sp.done === "off" ? sp.done : null;
  const failed = sp.failed === "1";

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">문자 수신 설정</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        강사잇다 교육 과정 안내와 강의 섭외·새 공고 소식을 문자로 받을지 정해요. 언제든 바꿀 수 있어요.
      </p>

      {failed && (
        <p role="alert" className="mt-4 rounded-card bg-warn/8 px-5 py-4 text-[15px] font-semibold text-warn">
          바꾸지 못했어요. 잠시 뒤에 다시 시도해 주세요.
        </p>
      )}
      {done && consent?.updatedAt && (
        <p role="status" className="mt-4 rounded-card bg-ok/10 px-5 py-4 text-[15px] font-semibold text-ok">
          {formatKoreanDate(seoulDateOf(consent.updatedAt))}에 문자 수신 {done === "on" ? "동의" : "거부"}가 처리되었어요.
        </p>
      )}

      <div className="mt-5 rounded-card bg-white p-5 md:p-7">
        {consent ? (
          <>
            <p className="text-[13px] font-semibold text-muted">지금 상태</p>
            <p className={`mt-1 text-[22px] font-bold ${consent.agreed ? "text-ok" : "text-ink"}`}>
              {consent.agreed ? "문자를 받고 있어요" : "문자를 받지 않아요"}
            </p>
            {consent.updatedAt && (
              <p className="nums mt-1 text-[13px] text-muted">{formatKoreanDate(seoulDateOf(consent.updatedAt))}에 마지막으로 바꿈</p>
            )}
            <div className="mt-5">
              <SmsButton agreed={consent.agreed} />
            </div>
          </>
        ) : (
          <p className="text-[15px] text-muted">지금은 설정을 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.</p>
        )}

        <dl className="mt-6 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
          <dt className="font-medium text-ink">받는 번호</dt>
          <dd>가입할 때 적은 연락처</dd>
          <dt className="font-medium text-ink">이용 목적</dt>
          <dd>{SMS_TERMS.purpose}</dd>
          <dt className="font-medium text-ink">보관 기간</dt>
          <dd>{SMS_TERMS.retention}</dd>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          받지 않아도 강사잇다 이용에는 아무 제한이 없어요. 광고 문자는 맨 앞에 (광고)를 붙이고, 밤 9시~아침 8시에는 보내지 않아요.
        </p>
      </div>
    </section>
  );
}
