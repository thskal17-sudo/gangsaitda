import type { Metadata } from "next";
import NotFoundCard from "@/components/not-found-card";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

/** 없는 주소로 들어왔을 때 보여주는 화면 (위쪽 띠·아래 탭은 그대로 보인다) */
export default function NotFound() {
  return (
    <NotFoundCard
      title="페이지를 찾을 수 없어요"
      description="주소가 바뀌었거나 없어진 페이지예요."
      primary={{ href: "/", label: "홈으로" }}
      secondary={{ href: "/jobs", label: "공고 보기" }}
    />
  );
}
