import type { Metadata } from "next";
import ComingSoon from "@/components/coming-soon";

export const metadata: Metadata = { title: "자격증" };

export default function CertificatesPage() {
  return <ComingSoon title="자격증" description="한국엑스퍼트교육원의 자격증 과정 안내와 신청을 곧 이곳에서 할 수 있습니다." />;
}
