/** 아직 만들지 않은 메뉴에 잠시 보여주는 화면 */
export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h1 className="text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">{title}</h1>
      <div className="mt-5 rounded-card bg-white p-6 text-center md:p-10">
        <p className="text-[17px] font-bold tracking-tight text-ink">준비 중입니다</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </section>
  );
}
