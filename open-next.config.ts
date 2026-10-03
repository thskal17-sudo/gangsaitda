// Cloudflare 에서 돌리기 위한 OpenNext 설정. 모든 화면을 열 때마다 새로 그리므로 따로 캐시를 두지 않는다.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
