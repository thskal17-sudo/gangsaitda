import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { MembersOnlyNotice } from "@/components/job-detail";
import MemberTypeNotice from "@/components/member-type-notice";
import { getCurrentMember, getMemberType } from "@/lib/member";
import { OPERATOR } from "@/lib/site";

export const metadata: Metadata = { title: "강사잇다 활용설명서", robots: { index: false, follow: false } };

/**
 * 기관 담당자 전용 · 강사잇다 활용설명서. 의뢰 → 공고 → 강사 고르기 → 확정 → 만족도까지 어떻게 쓰는지 순서대로 설명한다.
 * 비회원에게는 가입 안내, 강사 회원에게는 '기관 담당자 전용' 안내가 보인다. 내용이 바뀌면 이 파일만 고친다.
 * 휴대폰 '공유 → PDF로 저장'이나 PC '인쇄 → PDF' 로 파일처럼 보관할 수 있다.
 */
export default async function GuidePage() {
  await connection();
  const member = await getCurrentMember();
  const memberType = member ? await getMemberType() : null;

  if (!member) {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <Heading />
        <div className="mt-5">
          <MembersOnlyNotice
            next="/guide"
            title="기관 담당자 회원만 볼 수 있어요"
            description="기관 담당자로 가입하거나 로그인하면 활용설명서를 바로 볼 수 있습니다."
            cta="기관 담당자로 가입하고 보기"
          />
        </div>
      </section>
    );
  }
  if (memberType === "강사") {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <Heading />
        <div className="mt-5">
          <MemberTypeNotice need="기관" />
        </div>
      </section>
    );
  }

  return (
    <article className="mx-auto w-full max-w-[720px]">
      <Heading />
      <p className="mt-3 text-[13px] text-muted">
        파일로 두고 싶으면 휴대폰은 <b>공유 → PDF로 저장</b>, PC는 <b>인쇄 → PDF로 저장</b>을 눌러 주세요.
      </p>

      {/* 차례 */}
      <nav aria-label="차례" className="mt-5 rounded-card bg-white p-5 md:p-6">
        <p className="text-[13px] font-bold text-muted">차례</p>
        <ol className="nums mt-2 grid gap-1.5 text-[15px] font-semibold text-brand md:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 1. 한눈에 보는 흐름 */}
      <Section id={SECTIONS[0].id} n={1} title={SECTIONS[0].title}>
        <p>강사잇다는 학교·기관이 강사를 찾는 일을 운영자가 함께 챙겨 드리는 서비스예요. 전체 흐름은 이렇게 흘러가요.</p>
        <ol className="mt-3 flex flex-col gap-2">
          {FLOW.map((step, i) => (
            <li key={step.who + step.text} className="flex gap-3 rounded-control bg-bg px-4 py-3">
              <span className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-badge bg-brand text-[13px] font-bold text-white">{i + 1}</span>
              <span>
                <span className={`mr-1.5 rounded-badge px-2 py-0.5 text-[11px] font-bold ${WHO_STYLE[step.who]}`}>{step.who}</span>
                {step.text}
              </span>
            </li>
          ))}
        </ol>
        <Tip>의뢰서 작성부터 공고 게시, 강사 추천, 연락처 전달까지 <b>모두 무료</b>예요. 강사료는 기관과 강사님이 직접 정해요.</Tip>
      </Section>

      {/* 2. 회원가입 */}
      <Section id={SECTIONS[1].id} n={2} title={SECTIONS[1].title}>
        <Steps
          items={[
            <>
              사이트 맨 위(PC) 또는 아래 메뉴(휴대폰)의 <b>회원가입</b>을 눌러요.
            </>,
            <>
              <b>기관 담당자</b>를 고르고, 기관명·담당자 이름·연락처·이메일·비밀번호를 적어요. 가입은 무료예요.
            </>,
            <>
              [필수] 개인정보 동의를 체크해요. 교육·강의 섭외 소식 문자는 [선택]이라 체크하지 않아도 돼요.
            </>,
          ]}
        />
        <Tip>
          실수로 <b>강사</b>로 가입했다면 운영자 이메일({OPERATOR.email})로 알려 주세요. 종류를 바꿔 드려요. 담당자가 바뀌면 새 담당자가 가입한 뒤 알려 주시면 의뢰를 옮겨 드려요.
        </Tip>
      </Section>

      {/* 3. 의뢰하기 */}
      <Section id={SECTIONS[2].id} n={3} title={SECTIONS[2].title}>
        <Steps
          items={[
            <>
              메뉴의 <b>강사섭외</b>에서 의뢰서를 써요. 기관 정보, 담당자, 필요한 분야·과목, 희망 일정은 꼭 적고, 수업 대상·강사 수·예산은 적을 수 있으면 적어 주세요. 자세할수록 맞는 강사님을 빨리 찾아요.
            </>,
            <>
              보내면 운영자에게 바로 알림이 가요. 운영자는 <b>기관 대표번호나 담당자 연락처로 기관을 확인</b>한 뒤 일을 시작해요. 확인 전에는 추천 강사가 보이지 않아요.
            </>,
            <>
              보낸 의뢰는 사이트 맨 아래 <b>내 의뢰</b>에서 언제든 볼 수 있어요. 홈의 「내 의뢰」 상자로도 갈 수 있어요.
            </>,
          ]}
        />
      </Section>

      {/* 4. 모집 공고 */}
      <Section id={SECTIONS[3].id} n={4} title={SECTIONS[3].title}>
        <p>운영자 추천만 기다리지 않고, 강사잇다 공고 목록에 직접 모집 공고를 올릴 수도 있어요.</p>
        <Steps
          items={[
            <>
              <b>내 의뢰</b> → 의뢰 열기 → <b>[공고 쓰기]</b>. 제목과 내용은 의뢰서 내용으로 미리 채워져 있어요. 지원 마감일을 고르고 필요한 부분만 고쳐요.
            </>,
            <>
              <b>[검토 요청하기]</b>를 누르면 운영자가 내용을 확인해요. 승인되면 공고 목록에 바로 올라가고, 반려되면 사유를 보고 고쳐서 다시 낼 수 있어요.
            </>,
            <>
              공고에는 기관명·지역·일정은 나오지만 <b>담당자 이름·연락처·이메일은 나오지 않아요.</b> 지원은 강사잇다가 받아서 내 의뢰 화면으로 전달해요.
            </>,
            <>
              강사를 다 구했으면 <b>[모집 마감]</b>을 눌러 공고를 내려요. 승인된 뒤 내용을 고치려면 운영자에게 알려 주세요.
            </>,
          ]}
        />
      </Section>

      {/* 5. 강사 고르기 */}
      <Section id={SECTIONS[4].id} n={5} title={SECTIONS[4].title}>
        <p>
          기관 확인이 끝나면 <b>내 의뢰</b>에 운영자가 추천한 강사님과 공고를 보고 직접 지원한 강사님(「직접 지원」 표시)이 한 목록으로 보여요.
        </p>
        <Steps
          items={[
            <>
              강사님마다 <b>프로필</b>(작성한 내용이나 파일)과 <b>강의계획서</b>를 열어 봐요. 파일은 [내려받기]를 누르면 받아져요.
            </>,
            <>
              마음에 들면 <b>[이 강사님으로 할게요]</b>. 여러 명을 고를 수 있고, 취소도 돼요. 고르면 운영자가 강사님과 일정을 맞춰요.
            </>,
            <>
              마음에 드는 분이 없으면 <b>[다른 강사를 원해요]</b>에 원하는 조건을 한 줄 적어 보내요. 운영자가 새 강사님을 찾아 다시 추천해요.
            </>,
          ]}
        />
        <Tip>강사님 프로필은 의뢰 기관의 검토 용도로만 전달돼요. 다른 곳에 공유하거나 보관하지 말아 주세요.</Tip>
      </Section>

      {/* 6. 확정과 연락처 */}
      <Section id={SECTIONS[5].id} n={6} title={SECTIONS[5].title}>
        <Steps
          items={[
            <>
              운영자가 강사님과 일정·강사료를 맞추는 동안 강사 카드에 <b>「운영자가 일정을 맞추고 있어요」</b>가 보여요.
            </>,
            <>
              섭외가 정해지면 <b>「섭외 확정」</b>으로 바뀌고, 그때부터 강사님 <b>연락처(전화·이메일)</b>가 카드에 보여요. 이후 세부 조율은 강사님과 직접 하시면 돼요.
            </>,
            <>
              이번에 함께하기 어려운 강사님은 「이번엔 함께하기 어려워요」로 표시돼요.
            </>,
          ]}
        />
      </Section>

      {/* 7. 강의 뒤 */}
      <Section id={SECTIONS[6].id} n={7} title={SECTIONS[6].title}>
        <Steps
          items={[
            <>
              강의가 끝나 운영자가 의뢰를 <b>완료</b>로 바꾸면, 내 의뢰에 <b>「강의는 어떠셨나요?」</b> 칸이 생겨요. 별점과 한 줄 의견을 남겨 주세요. 운영자만 보고, 다음 추천에 참고해요.
            </>,
            <>
              완료된 의뢰에서는 개인정보 보호를 위해 강사님 프로필·파일·연락처가 더 이상 보이지 않아요. 다시 봐야 하면 운영자에게 알려 주세요.
            </>,
          ]}
        />
      </Section>

      {/* 8. 자주 묻는 질문 */}
      <Section id={SECTIONS[7].id} n={8} title={SECTIONS[7].title}>
        <dl className="flex flex-col gap-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-bold text-ink">Q. {f.q}</dt>
              <dd className="mt-1 text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="mt-6 rounded-card bg-brand/8 p-5 text-[15px] leading-relaxed text-ink md:p-6">
        <p className="font-bold">궁금한 점이 있으면 언제든 물어보세요.</p>
        <p className="mt-1">
          운영자 이메일{" "}
          <a href={`mailto:${OPERATOR.email}`} className="font-semibold text-brand hover:underline">
            {OPERATOR.email}
          </a>
          <br />
          <Link href="/request" className="font-semibold text-brand hover:underline">
            강사섭외 의뢰하러 가기 →
          </Link>
        </p>
      </div>
    </article>
  );
}

const SECTIONS = [
  { id: "flow", title: "한눈에 보는 흐름" },
  { id: "signup", title: "기관 담당자로 가입하기" },
  { id: "request", title: "강사섭외 의뢰하기" },
  { id: "posting", title: "모집 공고 올리기" },
  { id: "pick", title: "추천·지원 강사 보고 고르기" },
  { id: "confirm", title: "섭외 확정과 연락처" },
  { id: "after", title: "강의가 끝난 뒤" },
  { id: "faq", title: "자주 묻는 질문" },
] as const;

const FLOW: { who: "기관" | "운영자" | "강사"; text: string }[] = [
  { who: "기관", text: "기관 담당자로 가입하고 강사섭외 의뢰서를 보내요." },
  { who: "운영자", text: "기관을 확인하고, 의뢰에 맞는 강사님을 찾아 추천해요." },
  { who: "기관", text: "원하면 모집 공고도 써요. 운영자가 검토한 뒤 공고 목록에 올려요." },
  { who: "강사", text: "공고를 보고 프로필·강의계획서로 직접 지원해요." },
  { who: "기관", text: "내 의뢰에서 추천·지원 강사님의 프로필을 보고 골라요. 없으면 다른 강사를 요청해요." },
  { who: "운영자", text: "고른 강사님과 일정·강사료를 맞추고 섭외를 확정해요. 이때 연락처를 알려 드려요." },
  { who: "기관", text: "강의가 끝나면 만족도를 남겨요." },
];

const WHO_STYLE = { 기관: "bg-brand text-white", 운영자: "bg-ink text-white", 강사: "bg-accent text-white" } as const;

const FAQ: { q: string; a: ReactNode }[] = [
  { q: "비용이 드나요?", a: "아니요. 의뢰서 작성, 모집 공고 게시, 강사 추천, 연락처 전달까지 모두 무료예요. 강사료는 기관과 강사님이 직접 정해요." },
  { q: "강사 추천까지 얼마나 걸리나요?", a: "기관 확인이 끝나면 보통 며칠 안에 첫 추천을 드려요. 일정이 급하면 의뢰서의 요청 사항에 적어 주세요." },
  { q: "담당자 연락처가 강사에게 보이나요?", a: "아니요. 담당자 이름·연락처·이메일은 공고에도, 강사 화면에도 나오지 않아요. 섭외가 확정된 강사님에게만 운영자가 필요한 범위에서 연결해 드려요." },
  { q: "담당자가 바뀌면 어떻게 하나요?", a: "새 담당자가 기관 담당자로 가입한 뒤 운영자 이메일로 알려 주세요. 의뢰를 새 계정으로 옮겨 드려요." },
  { q: "의뢰를 취소하고 싶어요.", a: "운영자 이메일로 알려 주시면 바로 정리해 드려요. 올려 둔 모집 공고는 내 의뢰에서 [모집 마감]을 누르면 바로 내려가요." },
  { q: "문자(광고성 정보) 수신은 어떻게 끄나요?", a: "사이트 맨 아래 '문자 수신 설정'에서 언제든 켜고 끌 수 있어요." },
];

function Heading() {
  return (
    <>
      <p className="text-[13px] font-bold text-brand">기관 담당자 전용</p>
      <h1 className="mt-1 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">강사잇다 활용설명서</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">강사섭외 의뢰부터 강사 고르기, 확정, 만족도까지 — 강사잇다를 이렇게 쓰시면 돼요.</p>
    </>
  );
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-4 scroll-mt-20 rounded-card bg-white p-5 text-[15px] leading-relaxed text-ink md:p-6">
      <h2 id={`${id}-title`} className="text-[19px] font-bold tracking-tight text-ink">
        <span className="nums mr-1.5 text-brand">{n}.</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-badge bg-bg text-[13px] font-bold text-ink">{i + 1}</span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-control bg-accent/10 px-4 py-3 text-[14px] leading-relaxed text-ink">💡 {children}</p>;
}
