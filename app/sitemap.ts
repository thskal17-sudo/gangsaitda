import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { todayInSeoul } from "@/lib/date";
import { getOpenJobTitles } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

/**
 * 사이트맵 (sitemap.xml). 검색엔진이 어떤 화면이 있는지 한 번에 알게 한다.
 * 고정 화면 + 지금 지원할 수 있는 공고 상세(비회원에게도 제목이 보이는 것). 열 때마다 새로 만든다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/jobs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/request`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/certificates`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
  ];

  try {
    const jobs = await getOpenJobTitles(todayInSeoul());
    for (const job of jobs) {
      pages.push({ url: `${SITE_URL}/jobs/${job.id}`, lastModified: now, changeFrequency: "daily", priority: 0.7 });
    }
  } catch (err) {
    // 공고를 못 읽어도 고정 화면만으로 사이트맵을 낸다
    console.error("[sitemap] 공고 목록을 읽지 못함", err instanceof Error ? err.message : err);
  }
  return pages;
}
