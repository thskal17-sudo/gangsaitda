import NotFoundCard from "@/components/not-found-card";

/** 없는(또는 지워진) 공고 번호로 들어왔을 때 */
export default function JobNotFound() {
  return (
    <NotFoundCard
      title="공고를 찾을 수 없어요"
      description="주소가 잘못되었거나 삭제된 공고예요."
      primary={{ href: "/jobs", label: "공고 목록 보기" }}
      secondary={{ href: "/", label: "홈으로" }}
    />
  );
}
