import Link from "next/link";
import type { ReactNode } from "react";
import { OPERATOR } from "@/lib/site";

/**
 * 사이트 맨 아래. 운영자 정보(lib/site.ts 의 OPERATOR)와, 회원에게만 '회원 탈퇴' 링크를 보여준다.
 */
export default function SiteFooter({ isMember }: { isMember: boolean }) {
  const o = OPERATOR;

  return (
    <footer className="mt-12 border-t border-line pt-5 text-[13px] leading-relaxed text-muted md:mt-16">
      <address className="flex flex-col gap-1 not-italic">
        <Line items={[o.name, `대표자: ${o.representative}`]} />
        <Line items={[o.address]} />
        <Line
          items={[
            `사업자등록번호: ${o.businessNumber}`,
            o.mailOrderNumber && `통신판매업신고번호: ${o.mailOrderNumber}`,
          ]}
        />
        <Line items={[o.jobInfoNumber && `직업정보제공사업 신고번호: ${o.jobInfoNumber}`]} />
        <Line
          items={[
            <>
              이메일:{" "}
              <a href={`mailto:${o.email}`} className="hover:text-ink hover:underline">
                {o.email}
              </a>
            </>,
          ]}
        />
      </address>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>© 강사잇다</span>
        <Link href="/privacy" className="font-semibold text-ink hover:underline">
          개인정보처리방침
        </Link>
        {isMember && (
          <>
            <Link href="/account/profile" className="hover:text-ink hover:underline">
              내 프로필
            </Link>
            <Link href="/account/delete" className="hover:text-ink hover:underline">
              회원 탈퇴
            </Link>
          </>
        )}
      </div>
    </footer>
  );
}

/** 한 줄에 여러 항목을 세로 막대(|)로 나눠 보여준다. 비어 있는 항목은 빼고, 모두 비면 줄을 그리지 않는다. */
function Line({ items }: { items: (ReactNode | null | false | "")[] }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <p className="nums flex flex-wrap items-center gap-x-2">
      {shown.map((item, i) => (
        <span key={i} className="flex items-center gap-x-2">
          {i > 0 && (
            <span aria-hidden="true" className="h-3 w-px bg-line" />
          )}
          <span>{item}</span>
        </span>
      ))}
    </p>
  );
}
