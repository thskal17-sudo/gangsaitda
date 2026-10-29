import type { ReactNode } from "react";

/*
 * 약관·방침 같은 긴 글 화면(개인정보처리방침 /privacy, 이용약관 /terms)이 함께 쓰는 조각.
 * 번호 달린 절, 글머리 목록, 옆으로 미는 표, 링크 글자.
 */

/** 번호 달린 절. 제목 앞에 "1." 처럼 번호가 붙는다. prefix 로 "제1조" 모양도 만들 수 있다. */
export function Section({ n, title, prefix, children }: { n: number; title: string; prefix?: "조"; children: ReactNode }) {
  return (
    <section className="border-b border-line pb-5 last:border-b-0 last:pb-0">
      <h2 className="mb-2 text-[17px] font-bold tracking-tight text-ink">
        <span className="nums">{prefix === "조" ? `제${n}조` : `${n}.`}</span> {title}
      </h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** 번호(①②…)가 붙는 항 목록. 약관의 "제N조 ①, ②" 모양. */
export function Clauses({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-2 space-y-1.5 text-ink">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="nums shrink-0 text-muted">{CIRCLED[i] ?? `${i + 1}.`}</span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

/** 용어와 뜻처럼 "이름 – 설명" 짝 목록. 표와 달리 휴대폰에서도 옆으로 밀지 않고 줄을 바꾼다. */
export function Defs({ items }: { items: { term: string; text: ReactNode; note?: string }[] }) {
  return (
    <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-ink">
      {items.map((d) => (
        <div key={d.term} className="contents">
          <dt className="font-semibold">{d.term}</dt>
          <dd>
            {d.text}
            {d.note && <span className="mt-0.5 block text-[13px] text-muted">{d.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 휴대폰에서는 옆으로 밀어서 보는 표 */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line bg-bg">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line align-top last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 ${j === 0 ? "font-semibold whitespace-nowrap" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LinkText({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-brand underline-offset-2 hover:underline"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
