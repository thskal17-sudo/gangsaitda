import type { Metadata } from "next";
import ComingSoon from "@/components/coming-soon";

export const metadata: Metadata = { title: "강사섭외의뢰" };

export default function RequestPage() {
  return <ComingSoon title="강사섭외의뢰" description="강사가 필요한 학교·기관에서 강사 섭외를 의뢰하실 수 있도록 준비하고 있습니다." />;
}
