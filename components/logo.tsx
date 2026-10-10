/**
 * 로고 글자 "강사잇다" — 고운바탕 굵은체, "잇"만 시그니처 주황.
 * 그림(public/logo.png) 대신 글자로 그려서 크기를 바꿔도 선명하고, 색·굵기를 app/globals.css(.logo-text)에서 조절한다.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo-text inline-flex items-baseline text-ink ${className}`} aria-label="강사잇다">
      <span aria-hidden="true">강사</span>
      <span aria-hidden="true" className="text-brand">
        잇
      </span>
      <span aria-hidden="true">다</span>
    </span>
  );
}
