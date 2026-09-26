import Link from "next/link";

/** 사이트 맨 아래. 회원에게만 '회원 탈퇴' 링크를 보여준다. (개인정보처리방침 링크도 여기에 붙일 예정) */
export default function SiteFooter({ isMember }: { isMember: boolean }) {
  return (
    <footer className="mt-12 border-t border-line pt-5 text-[13px] text-muted md:mt-16">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>© 강사잇다</span>
        {isMember && (
          <Link href="/account/delete" className="hover:text-ink hover:underline">
            회원 탈퇴
          </Link>
        )}
      </div>
    </footer>
  );
}
