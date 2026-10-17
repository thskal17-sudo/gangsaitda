import Link from "next/link";
import type { MemberType } from "@/lib/auth-schema";
import { OPERATOR } from "@/lib/site";

/**
 * 회원 종류가 맞지 않는 화면에 들어왔을 때의 안내.
 * 예) 기관 회원이 '내 프로필'에, 강사 회원이 '강사섭외 의뢰'에 들어왔을 때.
 * 종류는 회원이 바꿀 수 없어서 운영자에게 알려 달라고 안내하고, 그 회원이 쓰는 화면으로 보낸다.
 */
export default function MemberTypeNotice({ need }: { need: MemberType }) {
  const text =
    need === "강사"
      ? {
          title: "강사 회원 전용 화면이에요",
          description: "기관 담당자로 가입하셔서 강사 프로필을 낼 수 없어요.",
          href: "/account/requests",
          cta: "내 의뢰 보기",
        }
      : {
          title: "기관 담당자 회원 전용 화면이에요",
          description: "강사로 가입하셔서 강사섭외를 의뢰할 수 없어요.",
          href: "/account/profile",
          cta: "내 프로필 등록하기",
        };

  return (
    <section className="rounded-card bg-white p-6 text-center md:p-10">
      <h2 className="text-lg font-bold text-ink">{text.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {text.description}
        <br />
        가입할 때 종류를 잘못 고르셨다면{" "}
        <a href={`mailto:${OPERATOR.email}`} className="font-semibold text-brand hover:underline">
          운영자 이메일
        </a>
        로 알려 주세요. 바꿔 드릴게요.
      </p>
      <Link
        href={text.href}
        className="mx-auto mt-6 flex h-14 w-full max-w-xs items-center justify-center rounded-control bg-brand text-[16px] font-semibold text-white transition-colors hover:bg-brand/90"
      >
        {text.cta}
      </Link>
    </section>
  );
}
