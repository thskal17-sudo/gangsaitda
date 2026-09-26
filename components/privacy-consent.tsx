import type { UseFormRegisterReturn } from "react-hook-form";

type Terms = { items: string; purpose: string; retention: string; refusal: string };

/** 개인정보 수집·이용 동의 (필수). 무엇을 왜 얼마나 보관하는지 펼쳐 볼 수 있다. */
export default function PrivacyConsent({
  terms,
  error,
  ...checkbox
}: { terms: Terms; error?: string } & UseFormRegisterReturn) {
  return (
    <div className={`rounded-control border-2 bg-bg p-4 ${error ? "border-warn" : "border-transparent"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "privacy-error" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          {...checkbox}
        />
        <span className="text-sm font-semibold text-ink">
          <span className="text-warn">[필수]</span> 개인정보 수집·이용에 동의합니다
        </span>
      </label>

      <details className="group mt-2 pl-8 text-sm text-muted">
        <summary className="cursor-pointer list-none font-medium underline underline-offset-2">
          <span className="group-open:hidden">내용 보기</span>
          <span className="hidden group-open:inline">내용 접기</span>
        </summary>
        <dl className="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 leading-relaxed">
          <dt className="font-medium text-ink">수집 항목</dt>
          <dd>{terms.items}</dd>
          <dt className="font-medium text-ink">이용 목적</dt>
          <dd>{terms.purpose}</dd>
          <dt className="font-medium text-ink">보관 기간</dt>
          <dd>{terms.retention}</dd>
        </dl>
        <p className="mt-2 leading-relaxed">{terms.refusal}</p>
      </details>

      {error && (
        <p id="privacy-error" className="mt-2 pl-8 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

/** 회원가입 동의 문구 (확정, 기획 문서 '4. 회원') */
export const SIGNUP_TERMS: Terms = {
  items: "이름, 연락처, 이메일",
  purpose: "회원 확인, 공고 상세 정보 제공, 서비스 이용 관련 안내 및 문의 응대",
  retention: "회원 탈퇴 시까지 (법령에 따라 보관해야 하는 경우 그 기간까지)",
  refusal: "동의를 거부할 수 있으나, 거부하면 회원가입을 할 수 없습니다. 광고·홍보 메시지는 보내지 않습니다.",
};

/** 강사섭외 의뢰 동의 문구 */
export const REQUEST_TERMS: Terms = {
  items: "담당자 이름, 연락처, 이메일",
  purpose: "강사 섭외 의뢰 확인 및 진행 상황 연락",
  retention: "의뢰 처리 완료 후 1년까지 (법령에 따라 보관해야 하는 경우 그 기간까지)",
  refusal: "동의를 거부할 수 있으나, 거부하면 의뢰를 접수할 수 없습니다. 광고·홍보 메시지는 보내지 않습니다.",
};
