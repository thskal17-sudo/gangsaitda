"use client";

import { useFormStatus } from "react-dom";
import type { MemberType } from "@/lib/auth-schema";
import { setMemberType } from "@/lib/admin-member-actions";

/** 회원 목록의 '기관으로 / 강사로' 바꾸기 버튼. 한 번 더 묻고 바꾼다. */
export default function MemberTypeButton({ id, name, type }: { id: string; name: string; type: MemberType }) {
  const other: MemberType = type === "강사" ? "기관" : "강사";
  return (
    <form
      action={setMemberType.bind(null, id, other)}
      onSubmit={(e) => {
        if (!window.confirm(`${name} 님을 ${other} 회원으로 바꿀까요?`)) e.preventDefault();
      }}
    >
      <Submit label={other === "강사" ? "강사로" : "기관으로"} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-8 items-center rounded-control bg-bg px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-line hover:text-ink disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "바꾸는 중…" : label}
    </button>
  );
}
