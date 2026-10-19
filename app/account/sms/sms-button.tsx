"use client";

import { useFormStatus } from "react-dom";
import { setMySmsConsent } from "@/lib/sms-consent-actions";

/** 문자 수신 켜기 / 끄기 버튼. 누르는 동안에는 한 번 더 눌리지 않게 한다. */
export default function SmsButton({ agreed }: { agreed: boolean }) {
  return (
    <form action={setMySmsConsent.bind(null, !agreed)}>
      <Submit agreed={agreed} />
    </form>
  );
}

function Submit({ agreed }: { agreed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-14 w-full items-center justify-center rounded-control text-[16px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
        agreed ? "bg-bg text-ink hover:bg-line" : "bg-brand text-white hover:bg-brand/90"
      }`}
    >
      {pending ? "처리 중…" : agreed ? "문자 그만 받기" : "문자 받기"}
    </button>
  );
}
