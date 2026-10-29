import Link from "next/link";
import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * 서비스 이용약관 동의 (회원가입, 필수). 개인정보 동의 칸(privacy-consent.tsx)과 같은 모양이고,
 * 펼치면 약관의 핵심만 보여 주고 전체는 /terms 로 이어 준다.
 */
export default function TermsConsent({ error, ...checkbox }: { error?: string } & UseFormRegisterReturn) {
  const errorId = `${checkbox.name}-error`;
  return (
    <div className={`rounded-control border-2 bg-bg p-4 ${error ? "border-warn" : "border-transparent"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          {...checkbox}
        />
        <span className="text-sm font-semibold text-ink">
          <span className="text-warn">[필수]</span> 서비스 이용약관에 동의합니다
        </span>
      </label>

      <details className="group mt-2 pl-8 text-sm text-muted">
        <summary className="cursor-pointer list-none font-medium underline underline-offset-2">
          <span className="group-open:hidden">내용 보기</span>
          <span className="hidden group-open:inline">내용 접기</span>
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 leading-relaxed">
          {TERMS_SUMMARY.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Link href="/terms" target="_blank" className="mt-2 inline-block font-medium text-brand underline underline-offset-2">
          이용약관 전체 보기
        </Link>
      </details>

      {error && (
        <p id={errorId} className="mt-2 pl-8 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

/** 가입 화면에서 펼쳐 보는 약관 요약 (전체는 app/terms/page.tsx) */
const TERMS_SUMMARY = [
  "회원가입과 공고 보기·지원, 프로필 등록, 강사섭외 의뢰는 모두 무료입니다.",
  "강의 계약은 강사와 기관이 직접 맺습니다. 강사잇다는 공고와 프로필을 전달하고 추천하는 일을 합니다.",
  "가입·공고·프로필은 사실대로 적고, 전달받은 다른 회원의 정보는 섭외·채용 검토에만 씁니다.",
  "언제든 사이트 맨 아래 '회원 탈퇴'에서 탈퇴할 수 있습니다.",
];
