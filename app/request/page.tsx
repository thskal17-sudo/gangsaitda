import type { Metadata } from "next";
import ComingSoon from "@/components/coming-soon";

export const metadata: Metadata = { title: "기관의뢰" };

export default function RequestPage() {
  return <ComingSoon title="기관의뢰" description="강사가 필요한 학교·기관에서 의뢰를 남기실 수 있도록 준비하고 있습니다." />;
}
