import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * 검색엔진 안내문 (robots.txt). 공개 화면은 모두 긁어가도 되고,
 * 관리자·내 계정·받는 문(api)은 검색 결과에 나오면 안 되므로 막는다. 사이트맵 주소도 알려 준다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
